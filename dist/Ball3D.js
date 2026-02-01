import * as THREE from 'three';
export class Ball3D {
    constructor() {
        this.worldAngle = 0;
        this.angularVelocity = 0;
        this.radialVelocity = 0;
        this.distanceFromCenter = 0;
        this.height = 0;
        this.verticalVelocity = 0;
        this.friction = 0.996; // Professional ball friction
        this.gravity = 0.012;
        this.isLocked = false;
        this.innerRadius = 1.2;
        this.outerRadius = 5.0;
        this.targetRadius = 3.5;
        const geom = new THREE.SphereGeometry(0.12, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1 });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = true;
    }
    launch(speed) {
        this.isLocked = false;
        this.angularVelocity = -speed; // High speed flick
        this.radialVelocity = 0;
        this.distanceFromCenter = this.outerRadius * 1.02;
        this.height = 0.6; // Start on the track
        this.verticalVelocity = 0;
        this.worldAngle = Math.random() * Math.PI * 2;
    }
    update(wheelAngle, wheelRotationSpeed) {
        if (this.isLocked) {
            this.worldAngle += wheelRotationSpeed;
            this.mesh.position.set(Math.cos(this.worldAngle) * this.distanceFromCenter, 0.2, Math.sin(this.worldAngle) * this.distanceFromCenter);
            return;
        }
        // Angular
        this.worldAngle += this.angularVelocity;
        this.angularVelocity *= this.friction;
        // Radial
        const centrifugal = (this.angularVelocity * this.angularVelocity) * this.distanceFromCenter * 2;
        const radialForce = centrifugal - this.gravity;
        this.radialVelocity = (this.radialVelocity + radialForce) * 0.9;
        this.distanceFromCenter += this.radialVelocity;
        // Height/Gravity (Human drop feel)
        if (this.height > 0.2) {
            this.verticalVelocity -= 0.002;
            this.height += this.verticalVelocity;
        }
        else {
            this.height = 0.2;
            this.verticalVelocity *= -0.4; // Bounce
        }
        // Rim constraints
        if (this.distanceFromCenter > this.outerRadius * 1.1) {
            this.distanceFromCenter = this.outerRadius * 1.1;
            this.radialVelocity *= -0.3;
        }
        // Diamond/Divider Collisions
        const relativeAngle = ((this.worldAngle - wheelAngle) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);
        const anglePerPocket = (Math.PI * 2) / 38;
        // Diamonds (8 deflectors)
        const numDiamonds = 8;
        for (let i = 0; i < numDiamonds; i++) {
            const diamondAngle = (i * Math.PI * 2) / numDiamonds + wheelAngle * 0.5;
            const angleDiff = Math.abs(((this.worldAngle - diamondAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
            if (angleDiff < 0.1 && this.distanceFromCenter > this.outerRadius * 0.9) {
                this.angularVelocity = -this.angularVelocity * 0.4 + (Math.random() - 0.5) * 0.1;
                this.radialVelocity = -0.05 - Math.random() * 0.05;
                this.verticalVelocity = 0.02;
            }
        }
        // Dividers
        if (this.distanceFromCenter < this.outerRadius * 0.9) {
            const pocketIndex = Math.floor(relativeAngle / anglePerPocket);
            const pocketStartAngle = pocketIndex * anglePerPocket;
            const distFromDivider = Math.min(Math.abs(relativeAngle - pocketStartAngle), Math.abs(relativeAngle - (pocketStartAngle + anglePerPocket)));
            if (distFromDivider < 0.05 && Math.abs(this.angularVelocity - wheelRotationSpeed) > 0.02) {
                const chaos = (Math.random() - 0.5) * 0.05;
                this.angularVelocity = this.angularVelocity * 0.7 + wheelRotationSpeed * 0.3 + chaos;
                this.radialVelocity += 0.02 + Math.random() * 0.03;
                this.verticalVelocity = 0.02;
            }
        }
        // Locking
        if (Math.abs(this.angularVelocity - wheelRotationSpeed) < 0.01 && this.distanceFromCenter < this.outerRadius * 0.8) {
            const pocketIndex = Math.floor(relativeAngle / anglePerPocket);
            this.worldAngle = wheelAngle + (pocketIndex + 0.5) * anglePerPocket;
            this.distanceFromCenter = this.targetRadius;
            this.isLocked = true;
            this.angularVelocity = wheelRotationSpeed;
            this.radialVelocity = 0;
            this.height = 0.2;
        }
        this.mesh.position.set(Math.cos(this.worldAngle) * this.distanceFromCenter, this.height, Math.sin(this.worldAngle) * this.distanceFromCenter);
    }
    getWinningNumber(wheelAngle, pockets) {
        const anglePerPocket = (Math.PI * 2) / pockets.length;
        let ballRelativeToWheel = ((this.worldAngle - wheelAngle) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);
        let pocketIndex = Math.floor(ballRelativeToWheel / anglePerPocket + 1e-10);
        return pockets[pocketIndex % pockets.length];
    }
}
