import * as THREE from 'three';
export declare class Ball3D {
    mesh: THREE.Mesh;
    worldAngle: number;
    angularVelocity: number;
    radialVelocity: number;
    distanceFromCenter: number;
    height: number;
    verticalVelocity: number;
    friction: number;
    gravity: number;
    isLocked: boolean;
    innerRadius: number;
    outerRadius: number;
    targetRadius: number;
    constructor();
    launch(speed: number): void;
    update(wheelAngle: number, wheelRotationSpeed: number): void;
    getWinningNumber(wheelAngle: number, pockets: number[]): number;
}
//# sourceMappingURL=Ball3D.d.ts.map