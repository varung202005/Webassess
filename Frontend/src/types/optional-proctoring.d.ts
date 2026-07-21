declare module "face-api.js" {
  export class TinyFaceDetectorOptions {
    constructor(options?: { scoreThreshold?: number });
  }

  export const nets: {
    tinyFaceDetector: {
      loadFromUri: (url: string) => Promise<void>;
    };
  };

  export function detectAllFaces(
    input: HTMLVideoElement,
    options?: TinyFaceDetectorOptions,
  ): Promise<unknown[]>;
}

declare module "@tensorflow-models/coco-ssd" {
  export interface DetectedObject {
    class: string;
    score: number;
    bbox: [number, number, number, number];
  }

  export interface ObjectDetection {
    detect: (input: HTMLVideoElement) => Promise<DetectedObject[]>;
  }

  export function load(options?: { base?: string }): Promise<ObjectDetection>;
}

declare module "@tensorflow/tfjs" {
  export function ready(): Promise<void>;
}
