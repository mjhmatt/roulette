import { RouletteWheel } from "./RouletteWheel.js";
import { Ball } from "./Ball.js";
export class RouletteGame {
    constructor() {
        this.wheel = new RouletteWheel();
        this.mockCanvas = document.createElement("canvas");
        this.mockCanvas.width = 600;
        this.mockCanvas.height = 600;
        const ctx = this.mockCanvas.getContext("2d");
        if (!ctx) {
            throw new Error("Could not create mock canvas context");
        }
        const wheelRadius = this.wheel.getRadius(ctx);
        this.ball = new Ball(wheelRadius * 1.15, wheelRadius);
        this.ball.numPockets = this.wheel.pockets.length;
    }
    spin(wheelSpeed, ballSpeed) {
        this.wheel.spin(wheelSpeed);
        this.ball.launch(ballSpeed);
        this.ball.angle = Math.random() * Math.PI * 2;
        const maxIterations = 10000;
        let iterations = 0;
        while (!this.ball.isLocked && iterations < maxIterations) {
            this.wheel.update();
            this.ball.update(this.wheel.currentAngle, this.wheel.rotationSpeed);
            iterations++;
        }
        if (!this.ball.isLocked) {
            this.ball.isLocked = true;
            this.ball.distanceFromCenter = this.ball.targetRadius;
        }
        return this.ball.getWinningNumber(this.wheel.currentAngle, this.wheel.pockets);
    }
    reset() {
        this.wheel.currentAngle = 0;
        this.wheel.rotationSpeed = 0;
        const ctx = this.mockCanvas.getContext("2d");
        if (!ctx) {
            throw new Error("Could not get canvas context");
        }
        const wheelRadius = this.wheel.getRadius(ctx);
        this.ball = new Ball(wheelRadius * 1.15, wheelRadius);
        this.ball.numPockets = this.wheel.pockets.length;
    }
}
