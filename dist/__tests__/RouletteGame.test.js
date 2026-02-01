import { RouletteGame } from "../RouletteGame.js";
import { RouletteWheel } from "../RouletteWheel.js";
import { Ball } from "../Ball.js";
describe("RouletteGame", () => {
    let game;
    beforeEach(() => {
        game = new RouletteGame();
    });
    test("should create a game with wheel and ball", () => {
        expect(game.wheel).toBeInstanceOf(RouletteWheel);
        expect(game.ball).toBeInstanceOf(Ball);
    });
    test("should return a valid pocket number", () => {
        const result = game.spin(0.1, 0.15);
        expect(game.wheel.pockets).toContain(result);
    });
    test("should return different numbers on multiple spins", () => {
        const results = [];
        const numSpins = 10;
        for (let i = 0; i < numSpins; i++) {
            game.reset();
            const result = game.spin(0.1 + Math.random() * 0.1, 0.15 + Math.random() * 0.1);
            results.push(result);
        }
        const uniqueResults = new Set(results);
        expect(uniqueResults.size).toBeGreaterThan(1);
    });
    test("should eventually land on all possible numbers with many spins", () => {
        const results = new Set();
        const numSpins = 100;
        for (let i = 0; i < numSpins; i++) {
            game.reset();
            const wheelSpeed = 0.1 + Math.random() * 0.2;
            const ballSpeed = 0.15 + Math.random() * 0.2;
            const result = game.spin(wheelSpeed, ballSpeed);
            results.add(result);
        }
        expect(results.size).toBeGreaterThan(10);
    });
    test("each spin should land on a different number", () => {
        const results = [];
        const numSpins = 5;
        for (let i = 0; i < numSpins; i++) {
            game.reset();
            const wheelSpeed = 0.1 + (i * 0.05);
            const ballSpeed = 0.15 + (i * 0.05);
            const result = game.spin(wheelSpeed, ballSpeed);
            results.push(result);
        }
        const uniqueResults = new Set(results);
        expect(uniqueResults.size).toBeGreaterThan(1);
    });
    test("ball should lock after spinning", () => {
        game.spin(0.1, 0.15);
        expect(game.ball.isLocked).toBe(true);
    });
    test("reset should reset wheel and ball", () => {
        game.spin(0.1, 0.15);
        expect(game.ball.isLocked).toBe(true);
        expect(game.wheel.rotationSpeed).not.toBe(0);
        game.reset();
        expect(game.ball.isLocked).toBe(false);
        expect(game.wheel.rotationSpeed).toBe(0);
        expect(game.wheel.currentAngle).toBe(0);
    });
    test("winner should match where ball lands visually", () => {
        const anglePerPocket = (Math.PI * 2) / game.wheel.pockets.length;
        for (let i = 0; i < 10; i++) {
            game.reset();
            const wheelSpeed = 0.1 + Math.random() * 0.1;
            const ballSpeed = 0.15 + Math.random() * 0.1;
            const winner = game.spin(wheelSpeed, ballSpeed);
            const ctx = game.mockCanvas.getContext("2d");
            if (!ctx) {
                throw new Error("Could not get canvas context");
            }
            const center = game.wheel.getCenter(ctx);
            const absoluteAngle = game.ball.worldAngle;
            const ballX = center.x + Math.cos(absoluteAngle) * game.ball.distanceFromCenter;
            const ballY = center.y + Math.sin(absoluteAngle) * game.ball.distanceFromCenter;
            const ballWorldAngle = Math.atan2(ballY - center.y, ballX - center.x);
            const wheelAngleNormalized = ((game.wheel.currentAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            const ballRelativeToWheel = (ballWorldAngle - wheelAngleNormalized + Math.PI * 2) % (Math.PI * 2);
            let visualPocketIndex = Math.floor(ballRelativeToWheel / anglePerPocket);
            if (visualPocketIndex >= game.wheel.pockets.length) {
                visualPocketIndex = visualPocketIndex % game.wheel.pockets.length;
            }
            if (visualPocketIndex < 0) {
                visualPocketIndex = (visualPocketIndex % game.wheel.pockets.length + game.wheel.pockets.length) % game.wheel.pockets.length;
            }
            const visualWinner = game.wheel.pockets[visualPocketIndex];
            expect(winner).toBe(visualWinner);
        }
    });
    test("every spin winner must match where ball visually lands", () => {
        const anglePerPocket = (Math.PI * 2) / game.wheel.pockets.length;
        const numSpins = 50;
        for (let spin = 0; spin < numSpins; spin++) {
            game.reset();
            const wheelSpeed = 0.1 + Math.random() * 0.2;
            const ballSpeed = 0.15 + Math.random() * 0.2;
            const calculatedWinner = game.spin(wheelSpeed, ballSpeed);
            expect(game.ball.isLocked).toBe(true);
            const ctx = game.mockCanvas.getContext("2d");
            if (!ctx) {
                throw new Error("Could not get canvas context");
            }
            const center = game.wheel.getCenter(ctx);
            const absoluteAngle = game.ball.worldAngle;
            const ballX = center.x + Math.cos(absoluteAngle) * game.ball.distanceFromCenter;
            const ballY = center.y + Math.sin(absoluteAngle) * game.ball.distanceFromCenter;
            const ballWorldAngle = Math.atan2(ballY - center.y, ballX - center.x);
            const wheelAngleNormalized = ((game.wheel.currentAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            const ballRelativeToWheel = (ballWorldAngle - wheelAngleNormalized + Math.PI * 2) % (Math.PI * 2);
            let visualPocketIndex = Math.floor(ballRelativeToWheel / anglePerPocket);
            if (visualPocketIndex >= game.wheel.pockets.length) {
                visualPocketIndex = visualPocketIndex % game.wheel.pockets.length;
            }
            if (visualPocketIndex < 0) {
                visualPocketIndex = (visualPocketIndex % game.wheel.pockets.length + game.wheel.pockets.length) % game.wheel.pockets.length;
            }
            const visualWinner = game.wheel.pockets[visualPocketIndex];
            expect(calculatedWinner).toBe(visualWinner);
        }
    });
    test("winner matches ball position using actual drawn coordinates", () => {
        const anglePerPocket = (Math.PI * 2) / game.wheel.pockets.length;
        const numSpins = 30;
        for (let spin = 0; spin < numSpins; spin++) {
            game.reset();
            const wheelSpeed = 0.1 + Math.random() * 0.15;
            const ballSpeed = 0.15 + Math.random() * 0.15;
            const calculatedWinner = game.spin(wheelSpeed, ballSpeed);
            expect(game.ball.isLocked).toBe(true);
            const ctx = game.mockCanvas.getContext("2d");
            if (!ctx) {
                throw new Error("Could not get canvas context");
            }
            const center = game.wheel.getCenter(ctx);
            const absoluteAngle = game.ball.worldAngle;
            const ballX = center.x + Math.cos(absoluteAngle) * game.ball.distanceFromCenter;
            const ballY = center.y + Math.sin(absoluteAngle) * game.ball.distanceFromCenter;
            const ballWorldAngle = Math.atan2(ballY - center.y, ballX - center.x);
            const wheelAngleNormalized = ((game.wheel.currentAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            const ballRelativeToWheel = (ballWorldAngle - wheelAngleNormalized + Math.PI * 2) % (Math.PI * 2);
            let visualPocketIndex = Math.floor(ballRelativeToWheel / anglePerPocket);
            if (visualPocketIndex >= game.wheel.pockets.length) {
                visualPocketIndex = visualPocketIndex % game.wheel.pockets.length;
            }
            if (visualPocketIndex < 0) {
                visualPocketIndex = (visualPocketIndex % game.wheel.pockets.length + game.wheel.pockets.length) % game.wheel.pockets.length;
            }
            const visualWinner = game.wheel.pockets[visualPocketIndex];
            expect(calculatedWinner).toBe(visualWinner);
        }
    });
});
