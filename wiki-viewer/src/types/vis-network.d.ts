declare module 'vis-network/standalone' {
  export { Network, DataSet } from 'vis-network';
}

declare module 'vis-network' {
  interface VisData {
    nodes: {
      update(items: Array<{ id: string; hidden: boolean }>): void;
    };
    edges: {
      update(items: Array<{ id: string; hidden: boolean }>): void;
    };
  }
  interface Network {
    body: {
      data: VisData;
    };
  }
}
