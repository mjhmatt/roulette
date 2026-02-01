export declare class RouletteWheel {
    pockets: number[];
    currentAngle: number;
    rotationSpeed: number;
    friction: number;
    initialSpeed: number;
    spinTime: number;
    spin(initialVelocity: number): void;
    update(): void;
    getWinningNumber(): number;
    getRadius(ctx: CanvasRenderingContext2D): number;
    getCenter(ctx: CanvasRenderingContext2D): {
        x: number;
        y: number;
    };
    draw(ctx: CanvasRenderingContext2D): void;
    isRed(number: number): boolean;
}
//# sourceMappingURL=RouletteWheel.d.ts.map