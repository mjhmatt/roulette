export class Ball {
    constructor(initialDistance, wheelRadius) {
        this.worldAngle = 0; // Track in world space for natural physics
        this.angularVelocity = 0;
        this.radialVelocity = 0;
        this.friction = 0.992;
        this.gravity = 0.15; // Pulls ball toward center
        this.isLocked = false;
        this.numPockets = 38;
        this.distanceFromCenter = initialDistance;
        this.innerRadius = wheelRadius * 0.25;
        this.outerRadius = wheelRadius * 0.95;
        this.targetRadius = (this.innerRadius + this.outerRadius) / 2;
    }
    get angle() {
        const wheelAngle = window.wheel ? window.wheel.currentAngle : 0;
        return ((this.worldAngle - wheelAngle) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);
    }
    set angle(val) {
        const wheelAngle = window.wheel ? window.wheel.currentAngle : 0;
        this.worldAngle = val + wheelAngle;
    }
    get speed() {
        return this.angularVelocity;
    }
    set speed(val) {
        this.angularVelocity = val;
    }
    launch(initialSpeed) {
        this.isLocked = false;
        this.angularVelocity = -initialSpeed; // Launch OPPOSITE to wheel
        this.radialVelocity = 0;
        this.distanceFromCenter = this.outerRadius * 1.02;
    }
    update(wheelAngle, wheelRotationSpeed) {
        if (this.isLocked) {
            this.worldAngle += wheelRotationSpeed;
            return;
        }
        // 1. Angular Movement
        this.worldAngle += this.angularVelocity;
        this.angularVelocity *= this.friction;
        // 2. Radial Movement (Gravity vs Centrifugal Force)
        const centrifugalForce = (this.angularVelocity * this.angularVelocity) * this.distanceFromCenter * 2;
        const radialForce = centrifugalForce - this.gravity;
        this.radialVelocity += radialForce;
        this.radialVelocity *= 0.9;
        this.distanceFromCenter += this.radialVelocity;
        // 3. Keep on outer rim until slow
        if (this.distanceFromCenter > this.outerRadius * 1.05) {
            this.distanceFromCenter = this.outerRadius * 1.05;
            this.radialVelocity *= -0.3;
        }
        // 4. Interaction with Dividers and Diamonds
        const anglePerPocket = (Math.PI * 2) / this.numPockets;
        const relativeAngle = ((this.worldAngle - wheelAngle) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);
        // Hit a Diamond? (Outer rim deflectors)
        const numDiamonds = 8;
        for (let i = 0; i < numDiamonds; i++) {
            const diamondAngle = (i * Math.PI * 2) / numDiamonds + wheelAngle * 0.5;
            const angleDiff = Math.abs(((this.worldAngle - diamondAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
            if (angleDiff < 0.08 && this.distanceFromCenter > this.outerRadius * 0.92) {
                // High chaos scatter from diamond
                this.angularVelocity = -this.angularVelocity * 0.4 + (Math.random() - 0.5) * 0.15;
                this.radialVelocity = -1.0 - Math.random() * 0.8;
            }
        }
        if (this.distanceFromCenter < this.outerRadius) {
            const pocketIndex = Math.floor(relativeAngle / anglePerPocket);
            const pocketStartAngle = pocketIndex * anglePerPocket;
            const distFromDivider = Math.min(Math.abs(relativeAngle - pocketStartAngle), Math.abs(relativeAngle - (pocketStartAngle + anglePerPocket)));
            if (distFromDivider < 0.05 && Math.abs(this.angularVelocity - wheelRotationSpeed) > 0.02) {
                // High chaos kick from pocket divider
                const chaos = (Math.random() - 0.5) * 0.12;
                this.angularVelocity = this.angularVelocity * 0.6 + wheelRotationSpeed * 0.4 + chaos;
                this.radialVelocity += 0.5 + Math.random() * 1.0;
            }
        }
        // 5. Locking Logic
        if (Math.abs(this.angularVelocity - wheelRotationSpeed) < 0.015 && this.distanceFromCenter < this.outerRadius * 0.85) {
            const pocketIndex = Math.floor(relativeAngle / anglePerPocket);
            this.worldAngle = wheelAngle + (pocketIndex + 0.5) * anglePerPocket;
            this.distanceFromCenter = this.targetRadius;
            this.isLocked = true;
            this.angularVelocity = wheelRotationSpeed;
            this.radialVelocity = 0;
        }
    }
    getWinningNumber(wheelAngle, pockets) {
        const anglePerPocket = (Math.PI * 2) / pockets.length;
        let ballRelativeToWheel = ((this.worldAngle - wheelAngle) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);
        let pocketIndex = Math.floor(ballRelativeToWheel / anglePerPocket + 1e-10);
        return pockets[pocketIndex % pockets.length];
    }
    draw(ctx, centerX, centerY, wheelAngle) {
        const x = centerX + Math.cos(this.worldAngle) * this.distanceFromCenter;
        const y = centerY + Math.sin(this.worldAngle) * this.distanceFromCenter;
        ctx.save();
        // 1. Natural Shadow (Flat perspective)
        ctx.beginPath();
        ctx.arc(x + 4, y + 4, 10, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();
        // 2. Ball Body
        const gradient = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, 10);
        gradient.addColorStop(0, "#FFFFFF");
        gradient.addColorStop(1, "#D0D0D0");
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        // 3. Crisp Outline
        ctx.strokeStyle = "#333333";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}
