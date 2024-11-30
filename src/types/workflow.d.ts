declare interface Workflow {
  create(options: { params: { videoId: string } }): Promise<{
    id: string;
    status: () => Promise<{
      state: string;
      result?: {
        videoInfo: {
          title: string;
          length: number;
          author: string;
        };
        transcription: string;
      };
    }>;
  }>;

  get(id: string): Promise<{
    status: () => Promise<{
      state: string;
      result?: {
        videoInfo: {
          title: string;
          length: number;
          author: string;
        };
        transcription: string;
      };
    }>;
  }>;
}
