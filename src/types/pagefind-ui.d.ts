declare module "@pagefind/default-ui" {
  export interface PagefindOptions {
    element: string;
    baseUrl?: string;
    showImages?: boolean;
    showSubResults?: boolean;
    translations?: Record<string, string>;
    processTerm?: (term: string) => string;
  }
  export class PagefindUI {
    constructor(options: PagefindOptions);
    triggerSearch(term: string): void;
  }
}
