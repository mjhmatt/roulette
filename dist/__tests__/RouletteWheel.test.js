import { RouletteWheel } from "../RouletteWheel.js";
describe("RouletteWheel", () => {
    let wheel;
    let mockCanvas;
    let mockCtx;
    beforeEach(() => {
        wheel = new RouletteWheel();
        mockCanvas = document.createElement("canvas");
        mockCanvas.width = 600;
        mockCanvas.height = 600;
        const ctx = mockCanvas.getContext("2d");
        if (!ctx) {
            throw new Error("Could not create mock canvas context");
        }
        mockCtx = ctx;
    });
    test("should have 38 pockets (American roulette)", () => {
        expect(wheel.pockets.length).toBe(38);
    });
    test("should have pocket 0", () => {
        expect(wheel.pockets).toContain(0);
    });
    test("should have pocket 00 (represented as 37)", () => {
        expect(wheel.pockets).toContain(37);
    });
    test("should have all numbers from 0 to 36 plus 00 (37)", () => {
        const expectedNumbers = new Set([...Array.from({ length: 37 }, (_, i) => i), 37]);
        const actualNumbers = new Set(wheel.pockets);
        expect(actualNumbers).toEqual(expectedNumbers);
    });
    test("spin should set rotation speed", () => {
        wheel.spin(0.1);
        expect(wheel.rotationSpeed).toBe(0.1);
    });
    test("update should change current angle", () => {
        const initialAngle = wheel.currentAngle;
        wheel.spin(0.1);
        wheel.update();
        expect(wheel.currentAngle).not.toBe(initialAngle);
    });
    test("update should apply friction", () => {
        wheel.spin(0.1);
        const initialSpeed = wheel.rotationSpeed;
        wheel.update();
        expect(wheel.rotationSpeed).toBeLessThan(initialSpeed);
    });
    test("getWinningNumber should return a valid pocket", () => {
        const result = wheel.getWinningNumber();
        expect(wheel.pockets).toContain(result);
    });
    test("spin should set rotation speed", () => {
        wheel.spin(0.1);
        expect(wheel.rotationSpeed).toBe(0.1);
    });
    test("update should change current angle", () => {
        const initialAngle = wheel.currentAngle;
        wheel.spin(0.1);
        wheel.update();
        expect(wheel.currentAngle).not.toBe(initialAngle);
    });
    test("update should apply friction", () => {
        wheel.spin(0.1);
        const initialSpeed = wheel.rotationSpeed;
        wheel.update();
        expect(wheel.rotationSpeed).toBeLessThan(initialSpeed);
    });
    test("getWinningNumber should return a valid pocket", () => {
        const result = wheel.getWinningNumber();
        expect(wheel.pockets).toContain(result);
    });
    test("getRadius should return correct radius", () => {
        const radius = wheel.getRadius(mockCtx);
        expect(radius).toBe(280);
    });
    test("getCenter should return correct center", () => {
        const center = wheel.getCenter(mockCtx);
        expect(center.x).toBe(300);
        expect(center.y).toBe(300);
    });
});
