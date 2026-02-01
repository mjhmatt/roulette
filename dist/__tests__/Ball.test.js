import { Ball } from "../Ball.js";
describe("Ball", () => {
    let ball;
    beforeEach(() => {
        ball = new Ball(300, 280);
    });
    test("should initialize with correct distance", () => {
        expect(ball.distanceFromCenter).toBe(300);
        expect(ball.targetRadius).toBe(280 * 0.6); // Target is 60% of wheel radius (middle of pocket area)
    });
    test("launch should set speed and reset distance", () => {
        ball.launch(0.15);
        expect(ball.speed).toBe(-0.15); // Launched opposite
        expect(ball.distanceFromCenter).toBeGreaterThan(ball.targetRadius);
    });
    test("update should change angle", () => {
        const initialAngle = ball.angle;
        ball.speed = 0.1;
        ball.update(0, 0);
        expect(ball.angle).not.toBe(initialAngle);
    });
    test("update should apply friction", () => {
        ball.speed = 0.1;
        const initialSpeed = ball.speed;
        ball.update(0, 0);
        expect(Math.abs(ball.speed)).toBeLessThan(Math.abs(initialSpeed));
    });
    test("ball should drop when speed is low", () => {
        ball.distanceFromCenter = (280 * 0.95) * 1.02; // Start on rim
        ball.speed = -0.01;
        const initialDistance = ball.distanceFromCenter;
        ball.update(0, 0);
        expect(ball.distanceFromCenter).toBeLessThan(initialDistance);
    });
    test("ball should lock when distance reaches target", () => {
        ball.distanceFromCenter = (280 * 0.95) * 0.8;
        ball.speed = 0.005;
        while (!ball.isLocked) {
            ball.update(0, 0);
        }
        expect(ball.isLocked).toBe(true);
        expect(ball.distanceFromCenter).toBe(ball.targetRadius);
    });
    test("getWinningNumber should return valid pocket", () => {
        const pockets = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
            24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        ball.worldAngle = Math.PI / 2;
        const result = ball.getWinningNumber(0, pockets);
        expect(pockets).toContain(result);
    });
    test("getWinningNumber should match visual ball position at reference angle", () => {
        const pockets = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
            24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        const wheelAngle = 0;
        ball.worldAngle = 0;
        const winner = ball.getWinningNumber(wheelAngle, pockets);
        expect(winner).toBe(pockets[0]);
    });
    test("getWinningNumber should match visual ball position with wheel rotation", () => {
        const pockets = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
            24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        const anglePerPocket = (Math.PI * 2) / pockets.length;
        for (let pocketIndex = 0; pocketIndex < pockets.length; pocketIndex++) {
            const wheelAngle = 0;
            ball.worldAngle = pocketIndex * anglePerPocket;
            const winner = ball.getWinningNumber(wheelAngle, pockets);
            expect(winner).toBe(pockets[pocketIndex]);
        }
    });
    test("getWinningNumber should match visual ball position with rotated wheel", () => {
        const pockets = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
            24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        const anglePerPocket = (Math.PI * 2) / pockets.length;
        const testCases = [
            { wheelAngle: anglePerPocket * 5, targetPocketIndex: 0 },
            { wheelAngle: anglePerPocket * 10, targetPocketIndex: 0 },
            { wheelAngle: Math.PI, targetPocketIndex: 0 },
        ];
        testCases.forEach(({ wheelAngle, targetPocketIndex }) => {
            ball.worldAngle = wheelAngle + (targetPocketIndex * anglePerPocket);
            const winner = ball.getWinningNumber(wheelAngle, pockets);
            expect(winner).toBe(pockets[targetPocketIndex]);
        });
    });
});
