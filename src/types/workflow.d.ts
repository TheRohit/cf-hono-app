declare interface Workflow {
  create(options: { params: { videoId: string } }): Promise<WorkflowInstance>;
  get(id: string): Promise<WorkflowInstance>;
}

interface WorkflowInstance {
  id: string;
  status(): Promise<WorkflowInstanceStatus>;
}

interface WorkflowInstanceStatus {
  state: "pending" | "running" | "completed" | "failed";
  result?: {
    videoInfo: {
      videoId: string;
      title: string;
      length: number;
      author: string;
      thumbnail: string;
      description: string;
      views: string;
      publishedAt: string;
    };
    transcription: string;
  };
  error?: {
    message: string;
  };
}
