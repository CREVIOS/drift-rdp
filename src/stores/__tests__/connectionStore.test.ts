import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the tauri module before importing the store
vi.mock('../../lib/tauri', () => ({
  listConnections: vi.fn().mockResolvedValue([]),
  createConnection: vi.fn().mockImplementation((config) =>
    Promise.resolve({
      ...config,
      id: 'test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  ),
  updateConnection: vi.fn().mockImplementation((id, config) =>
    Promise.resolve({ id, ...config, updatedAt: new Date().toISOString() })
  ),
  deleteConnection: vi.fn().mockResolvedValue(undefined),
}));

import { useConnectionStore } from '../connectionStore';
import * as tauri from '../../lib/tauri';

const sampleConnection = {
  name: 'Test Server',
  host: '192.168.1.1',
  port: 3389,
  username: 'admin',
  domain: '',
  colorAccent: null,
  tags: [],
  displayWidth: null,
  displayHeight: null,
};

describe('connectionStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useConnectionStore.setState({
      connections: [],
      selectedId: null,
      searchQuery: '',
      viewMode: 'grid',
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('fetchConnections populates store', async () => {
    const mockConnections = [
      { ...sampleConnection, id: '1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { ...sampleConnection, id: '2', name: 'Server 2', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
    ];
    vi.mocked(tauri.listConnections).mockResolvedValueOnce(mockConnections);

    await useConnectionStore.getState().fetchConnections();

    const state = useConnectionStore.getState();
    expect(state.connections).toHaveLength(2);
    expect(state.connections[0].id).toBe('1');
    expect(state.connections[1].id).toBe('2');
    expect(state.isLoading).toBe(false);
  });

  it('createConnection adds to store', async () => {
    const created = await useConnectionStore.getState().createConnection(sampleConnection);

    const state = useConnectionStore.getState();
    expect(state.connections).toHaveLength(1);
    expect(created.id).toBe('test-id');
    expect(created.name).toBe('Test Server');
  });

  it('deleteConnection removes from store', async () => {
    // Seed the store with a connection
    useConnectionStore.setState({
      connections: [
        { ...sampleConnection, id: 'del-1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      ],
    });

    await useConnectionStore.getState().deleteConnection('del-1');

    const state = useConnectionStore.getState();
    expect(state.connections).toHaveLength(0);
  });

  it('deleteConnection clears selectedId if deleted', async () => {
    useConnectionStore.setState({
      connections: [
        { ...sampleConnection, id: 'sel-1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      ],
      selectedId: 'sel-1',
    });

    await useConnectionStore.getState().deleteConnection('sel-1');

    expect(useConnectionStore.getState().selectedId).toBeNull();
  });

  it('setSearchQuery updates query', () => {
    useConnectionStore.getState().setSearchQuery('production');
    expect(useConnectionStore.getState().searchQuery).toBe('production');
  });

  it('setViewMode toggles between grid and list', () => {
    expect(useConnectionStore.getState().viewMode).toBe('grid');

    useConnectionStore.getState().setViewMode('list');
    expect(useConnectionStore.getState().viewMode).toBe('list');

    useConnectionStore.getState().setViewMode('grid');
    expect(useConnectionStore.getState().viewMode).toBe('grid');
  });
});
