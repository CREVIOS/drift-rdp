use std::{collections::VecDeque, env};

use ironrdp::{
    cliprdr::{
        backend::{ClipboardMessage, CliprdrBackend},
        pdu::{
            ClipboardFormat, ClipboardFormatId, ClipboardGeneralCapabilityFlags,
            FileContentsRequest, FileContentsResponse, FormatDataRequest, FormatDataResponse,
            LockDataId,
        },
    },
    core::IntoOwned,
};

#[derive(Debug)]
pub struct SessionClipboardBackend {
    temporary_directory: String,
    pending_messages: VecDeque<ClipboardMessage>,
    local_text: Option<String>,
    remote_text_update: Option<String>,
    pending_remote_format: Option<ClipboardFormatId>,
}

impl SessionClipboardBackend {
    pub fn new() -> Self {
        Self {
            temporary_directory: env::temp_dir().to_string_lossy().into_owned(),
            pending_messages: VecDeque::new(),
            local_text: None,
            remote_text_update: None,
            pending_remote_format: None,
        }
    }

    pub fn set_local_text(&mut self, text: String) {
        self.local_text = Some(text);
        self.pending_messages
            .push_back(ClipboardMessage::SendInitiateCopy(vec![
                ClipboardFormat::new(ClipboardFormatId::CF_UNICODETEXT),
            ]));
    }

    pub fn take_pending_messages(&mut self) -> Vec<ClipboardMessage> {
        self.pending_messages.drain(..).collect()
    }

    pub fn take_remote_text_update(&mut self) -> Option<String> {
        self.remote_text_update.take()
    }
}

impl Default for SessionClipboardBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl ironrdp::core::AsAny for SessionClipboardBackend {
    fn as_any(&self) -> &dyn core::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn core::any::Any {
        self
    }
}

impl CliprdrBackend for SessionClipboardBackend {
    fn temporary_directory(&self) -> &str {
        &self.temporary_directory
    }

    fn client_capabilities(&self) -> ClipboardGeneralCapabilityFlags {
        ClipboardGeneralCapabilityFlags::empty()
    }

    fn on_ready(&mut self) {}

    fn on_request_format_list(&mut self) {
        if self
            .local_text
            .as_deref()
            .is_some_and(|text| !text.is_empty())
        {
            self.pending_messages
                .push_back(ClipboardMessage::SendInitiateCopy(vec![
                    ClipboardFormat::new(ClipboardFormatId::CF_UNICODETEXT),
                ]));
        }
    }

    fn on_process_negotiated_capabilities(
        &mut self,
        _capabilities: ClipboardGeneralCapabilityFlags,
    ) {
    }

    fn on_remote_copy(&mut self, available_formats: &[ClipboardFormat]) {
        let preferred_format = available_formats
            .iter()
            .find(|format| format.id() == ClipboardFormatId::CF_UNICODETEXT)
            .map(|format| format.id())
            .or_else(|| {
                available_formats
                    .iter()
                    .find(|format| format.id() == ClipboardFormatId::CF_TEXT)
                    .map(|format| format.id())
            });

        if let Some(format) = preferred_format {
            self.pending_remote_format = Some(format);
            self.pending_messages
                .push_back(ClipboardMessage::SendInitiatePaste(format));
        }
    }

    fn on_format_data_request(&mut self, request: FormatDataRequest) {
        let response = match (request.format, self.local_text.as_deref()) {
            (ClipboardFormatId::CF_UNICODETEXT, Some(text)) => {
                FormatDataResponse::new_unicode_string(text).into_owned()
            }
            (ClipboardFormatId::CF_TEXT, Some(text)) => {
                FormatDataResponse::new_string(text).into_owned()
            }
            _ => FormatDataResponse::new_error().into_owned(),
        };

        self.pending_messages
            .push_back(ClipboardMessage::SendFormatData(response));
    }

    fn on_format_data_response(&mut self, response: FormatDataResponse<'_>) {
        if response.is_error() {
            self.pending_remote_format = None;
            return;
        }

        let text = match self.pending_remote_format.take() {
            Some(ClipboardFormatId::CF_UNICODETEXT) => response.to_unicode_string().ok(),
            Some(ClipboardFormatId::CF_TEXT) => response.to_string().ok(),
            _ => None,
        };

        if let Some(text) = text.filter(|text| !text.is_empty()) {
            self.remote_text_update = Some(text);
        }
    }

    fn on_file_contents_request(&mut self, _request: FileContentsRequest) {}

    fn on_file_contents_response(&mut self, _response: FileContentsResponse<'_>) {}

    fn on_lock(&mut self, _data_id: LockDataId) {}

    fn on_unlock(&mut self, _data_id: LockDataId) {}
}
