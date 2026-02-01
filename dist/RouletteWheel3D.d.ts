import * as THREE from 'three';
export declare class RouletteWheel3D {
    mesh: THREE.Group;
    innerGroup: THREE.Group;
    pockets: number[];
    currentAngle: number;
    rotationSpeed: number;
    friction: number;
    constructor();
    private createWheel;
    private isRed;
    spin(speed: number): void;
    update(): void;
}
//# sourceMappingURL=RouletteWheel3D.d.ts.map