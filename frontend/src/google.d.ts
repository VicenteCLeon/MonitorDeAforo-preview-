declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            container: HTMLElement,
            options: {
              theme?: "outline" | "filled_black" | "filled_blue";
              size?: "large" | "medium" | "small";
              width?: number;
              text?: "signin_with" | "continue_with" | "signup_with";
              shape?: "rectangular" | "pill" | "circle" | "square";
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export {};
