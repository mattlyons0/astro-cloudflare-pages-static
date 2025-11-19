export interface DynamicRoutesOptions {
  /**
   * Additional paths to exclude from Cloudflare Pages routing
   */
  excludePaths?: string[];
}

export interface DynamicRoute {
  file: string;
  route: string;
  pattern: RegExp;
  shellPath: string;
  params: string[];
}
