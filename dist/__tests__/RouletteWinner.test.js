import { RouletteWheel } from "../RouletteWheel";
describe("Roulette Winner Calculation", () => {
    const wheel = new RouletteWheel();
    const anglePerPocket = (Math.PI * 2) / wheel.pockets.length;
    const referenceAngle = (3 * Math.PI) / 2;
    function calculateWinner(ballAngle, wheelAngle) {
        const ballAngleNormalized = ((ballAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
        const wheelAngleNormalized = ((wheelAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
        const ballRelativeToWheel = (ballAngleNormalized - wheelAngleNormalized + Math.PI * 2) % (Math.PI * 2);
        let normalizedAngle = (referenceAngle - ballRelativeToWheel + Math.PI * 2) % (Math.PI * 2);
        if (normalizedAngle < 0) {
            normalizedAngle += Math.PI * 2;
        }
        const pocketIndex = Math.floor(normalizedAngle / anglePerPocket);
        return wheel.pockets[pocketIndex];
    }
    test("should verify pocket order matches American roulette", () => {
        expect(wheel.pockets[0]).toBe(0);
        expect(wheel.pockets[1]).toBe(28);
        expect(wheel.pockets[19]).toBe(37); // 00
        expect(wheel.pockets[wheel.pockets.length - 1]).toBe(2);
    });
    test("should calculate winner when ball is at reference angle", () => {
        const wheelAngle = 0;
        const ballAngle = referenceAngle;
        const winner = calculateWinner(ballAngle, wheelAngle);
        expect(winner).toBe(wheel.pockets[0]);
    });
    test("should calculate winner when ball is one pocket clockwise from reference", () => {
        const wheelAngle = 0;
        const ballAngle = referenceAngle - anglePerPocket;
        const winner = calculateWinner(ballAngle, wheelAngle);
        expect(winner).toBe(wheel.pockets[1]);
    });
    test("should calculate winner accounting for wheel rotation", () => {
        const wheelAngle = anglePerPocket * 5;
        const ballAngle = referenceAngle + wheelAngle;
        const winner = calculateWinner(ballAngle, wheelAngle);
        expect(winner).toBe(wheel.pockets[0]);
    });
    test("should calculate winner when wheel has rotated multiple times", () => {
        const wheelAngle = Math.PI * 2 * 3 + anglePerPocket * 10;
        const ballAngle = referenceAngle + wheelAngle;
        const winner = calculateWinner(ballAngle, wheelAngle);
        expect(wheel.pockets).toContain(winner);
        expect(winner).toBeGreaterThanOrEqual(0);
        expect(winner).toBeLessThanOrEqual(36);
    });
    test("should return valid pocket number for all angles", () => {
        for (let i = 0; i < 100; i++) {
            const wheelAngle = Math.random() * Math.PI * 4;
            const ballAngle = Math.random() * Math.PI * 4;
            const winner = calculateWinner(ballAngle, wheelAngle);
            expect(wheel.pockets).toContain(winner);
            expect(winner).toBeGreaterThanOrEqual(0);
            expect(winner).toBeLessThanOrEqual(37);
        }
    });
    test("should match ball position to correct pocket", () => {
        for (let pocketIndex = 0; pocketIndex < wheel.pockets.length; pocketIndex++) {
            const wheelAngle = 0;
            const ballAngle = referenceAngle - (pocketIndex * anglePerPocket);
            const winner = calculateWinner(ballAngle, wheelAngle);
            expect(wheel.pockets).toContain(winner);
            expect(winner).toBeGreaterThanOrEqual(0);
            expect(winner).toBeLessThanOrEqual(37);
        }
    });
    test("should handle negative angles correctly", () => {
        const wheelAngle = -Math.PI;
        const ballAngle = referenceAngle - Math.PI;
        const winner = calculateWinner(ballAngle, wheelAngle);
        expect(wheel.pockets).toContain(winner);
    });
    test("should be consistent for same ball and wheel positions", () => {
        const wheelAngle = 1.234;
        const ballAngle = 2.345;
        const winner1 = calculateWinner(ballAngle, wheelAngle);
        const winner2 = calculateWinner(ballAngle, wheelAngle);
        expect(winner1).toBe(winner2);
    });
});
