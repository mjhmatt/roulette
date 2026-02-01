import { RouletteWheel } from "./RouletteWheel.js";
import { Ball } from "./Ball.js";
export declare class RouletteGame {
    wheel: RouletteWheel;
    ball: Ball;
    mockCanvas: HTMLCanvasElement;
    constructor();
    spin(wheelSpeed: number, ballSpeed: number): number;
    reset(): void;
}
//# sourceMappingURL=RouletteGame.d.ts.map