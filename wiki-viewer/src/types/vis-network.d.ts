declare module 'vis-network/standalone' {
  export class Network {
    constructor(
      container: HTMLElement,
      data: { nodes: any[]; edges: any[] },
      options?: any
    );
    destroy(): void;
    on(event: string, callback: (params: any) => void): void;
    body: {
      data: VisData;
    };
  }
  export class DataSet<T = any> {
    constructor(items?: T[]);
    add(items: T | T[]): void;
    update(items: T | T[]): void;
    remove(ids: string | string[]): void;
  }
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
    destroy(): void;
    on(event: string, callback: (params: any) => void): void;
    body: {
      data: VisData;
    };
  }
}
