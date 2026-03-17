use std::sync::Arc;
use std::sync::Mutex as StdMutex;

use super::shared_frame::SharedFrame;

/// Mutable texture state — single lock for all texture-related fields
struct TextureState {
    bind_group: Option<wgpu::BindGroup>,
    texture: Option<wgpu::Texture>,
    width: u32,
    height: u32,
}

pub struct GpuRenderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    surface_config: StdMutex<wgpu::SurfaceConfiguration>,
    render_pipeline: wgpu::RenderPipeline,
    bind_group_layout: wgpu::BindGroupLayout,
    tex_state: StdMutex<TextureState>,
    sampler: wgpu::Sampler,
    shared_frame: Arc<SharedFrame>,
}

impl GpuRenderer {
    pub async fn new(
        window: tauri::WebviewWindow,
        shared_frame: Arc<SharedFrame>,
    ) -> Result<Self, String> {
        let size = window
            .inner_size()
            .map_err(|e| format!("Failed to get window size: {}", e))?;

        let instance = wgpu::Instance::default();

        let surface = instance
            .create_surface(window)
            .map_err(|e| format!("Failed to create surface: {}", e))?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                force_fallback_adapter: false,
                compatible_surface: Some(&surface),
            })
            .await
            .ok_or_else(|| "No GPU adapter found".to_string())?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("drift-gpu"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    ..Default::default()
                },
                None,
            )
            .await
            .map_err(|e| format!("Failed to create GPU device: {}", e))?;

        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or(surface_caps.formats[0]);

        // Prefer Mailbox (lowest latency) with fallback to Fifo
        let present_mode = if surface_caps
            .present_modes
            .contains(&wgpu::PresentMode::Mailbox)
        {
            wgpu::PresentMode::Mailbox
        } else {
            wgpu::PresentMode::Fifo
        };

        let surface_config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width.max(1),
            height: size.height.max(1),
            present_mode,
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 1,
        };
        surface.configure(&device, &surface_config);

        // Fullscreen quad shader
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("fullscreen-quad"),
            source: wgpu::ShaderSource::Wgsl(include_str!("fullscreen_quad.wgsl").into()),
        });

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("texture-bgl"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("render-pipeline-layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("render-pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        Ok(Self {
            device,
            queue,
            surface,
            surface_config: StdMutex::new(surface_config),
            render_pipeline,
            bind_group_layout,
            tex_state: StdMutex::new(TextureState {
                bind_group: None,
                texture: None,
                width: 0,
                height: 0,
            }),
            sampler,
            shared_frame,
        })
    }

    pub fn resize(&self, width: u32, height: u32) {
        if width > 0 && height > 0 {
            let mut config = self.surface_config.lock().unwrap();
            config.width = width;
            config.height = height;
            self.surface.configure(&self.device, &config);
        }
    }

    /// Upload new frame data to the GPU texture if dirty, then render.
    pub fn render(&self) -> Result<(), wgpu::SurfaceError> {
        // Publish snapshot (zero-copy swap)
        let snapshot = match self.shared_frame.publish() {
            Some(s) => s,
            None => return Ok(()), // Nothing new — skip entirely
        };

        // Single lock for all texture state
        let mut ts = self.tex_state.lock().unwrap();

        // Recreate texture if dimensions changed
        if ts.width != snapshot.width || ts.height != snapshot.height || ts.texture.is_none() {
            let texture = self.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("rdp-frame"),
                size: wgpu::Extent3d {
                    width: snapshot.width,
                    height: snapshot.height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8UnormSrgb,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });

            let view = texture.create_view(&Default::default());
            ts.bind_group = Some(self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("texture-bg"),
                layout: &self.bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&self.sampler),
                    },
                ],
            }));
            ts.texture = Some(texture);
            ts.width = snapshot.width;
            ts.height = snapshot.height;
        }

        // Upload pixel data to GPU (DMA transfer)
        if let Some(ref texture) = ts.texture {
            self.queue.write_texture(
                wgpu::TexelCopyTextureInfo {
                    texture,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                &snapshot.data,
                wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(4 * snapshot.width),
                    rows_per_image: Some(snapshot.height),
                },
                wgpu::Extent3d {
                    width: snapshot.width,
                    height: snapshot.height,
                    depth_or_array_layers: 1,
                },
            );
        }

        // Render fullscreen quad
        let output = self.surface.get_current_texture()?;
        let view = output.texture.create_view(&Default::default());
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("render-encoder"),
        });

        {
            let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("render-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                ..Default::default()
            });

            if let Some(ref bind_group) = ts.bind_group {
                rpass.set_pipeline(&self.render_pipeline);
                rpass.set_bind_group(0, bind_group, &[]);
                rpass.draw(0..6, 0..1);
            }
        }
        // Release texture lock before GPU submit
        drop(ts);

        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();

        Ok(())
    }
}
