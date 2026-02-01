export declare class Ball {
    distanceFromCenter: number;
    worldAngle: number;
    angularVelocity: number;
    radialVelocity: number;
    friction: number;
    gravity: number;
    isLocked: boolean;
    targetRadius: number;
    innerRadius: number;
    outerRadius: number;
    numPockets: number;
    constructor(initialDistance: number, wheelRadius: number);
    get angle(): number;
    set angle(val: number);
    get speed(): number;
    set speed(val: number);
    launch(initialSpeed: number): void;
    update(wheelAngle: number, wheelRotationSpeed: number): void;
    getWinningNumber(wheelAngle: number, pockets: number[]): number;
    draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, wheelAngle: number): void;
}
//# sourceMappingURL=Ball.d.ts.map