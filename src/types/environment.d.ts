declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      HOST: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      GEMINI_API_KEY: string;
      N8N_BASE_URL: string;
      CORS_ORIGIN: string;
      FRONTEND_URL: string;
      [key: string]: string | undefined;
    }
  }
}

export {};
