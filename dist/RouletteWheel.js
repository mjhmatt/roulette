export class RouletteWheel {
    constructor() {
        this.pockets = [
            0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37,
            27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
        ];
        this.currentAngle = 0;
        this.rotationSpeed = 0;
        this.friction = 0.995; // Deterministic friction
        this.initialSpeed = 0;
        this.spinTime = 0;
    }
    spin(initialVelocity) {
        this.rotationSpeed = initialVelocity;
        this.initialSpeed = initialVelocity;
        this.spinTime = 0;
    }
    update() {
        this.currentAngle += this.rotationSpeed;
        this.spinTime += 1 / 60;
        this.rotationSpeed *= this.friction;
        this.currentAngle = this.currentAngle % (Math.PI * 2);
        if (this.currentAngle < 0) {
            this.currentAngle += Math.PI * 2;
        }
    }
    getWinningNumber() {
        const anglePerPocket = (Math.PI * 2) / this.pockets.length;
        const topAngle = (3 * Math.PI) / 2;
        let normalizedAngle = topAngle - this.currentAngle;
        normalizedAngle = normalizedAngle % (Math.PI * 2);
        if (normalizedAngle < 0) {
            normalizedAngle += Math.PI * 2;
        }
        const pocketIndex = Math.floor(normalizedAngle / anglePerPocket);
        return this.pockets[pocketIndex];
    }
    getRadius(ctx) {
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        return Math.min(centerX, centerY) - 20;
    }
    getCenter(ctx) {
        return {
            x: ctx.canvas.width / 2,
            y: ctx.canvas.height / 2,
        };
    }
    draw(ctx) {
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        const radius = this.getRadius(ctx);
        const innerRadius = radius * 0.25;
        const outerRadius = radius * 0.95;
        const anglePerPocket = (2 * Math.PI) / this.pockets.length;
        // Draw dark gray outer rim
        ctx.fillStyle = "#2a2a2a";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.currentAngle);
        // Draw white inner circle
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
        ctx.fill();
        // Draw pockets
        for (let i = 0; i < this.pockets.length; i++) {
            const startAngle = i * anglePerPocket;
            const endAngle = (i + 1) * anglePerPocket;
            ctx.beginPath();
            ctx.moveTo(Math.cos(startAngle) * innerRadius, Math.sin(startAngle) * innerRadius);
            ctx.lineTo(Math.cos(startAngle) * outerRadius, Math.sin(startAngle) * outerRadius);
            ctx.arc(0, 0, outerRadius, startAngle, endAngle, false);
            ctx.lineTo(Math.cos(endAngle) * innerRadius, Math.sin(endAngle) * innerRadius);
            ctx.arc(0, 0, innerRadius, endAngle, startAngle, true);
            ctx.closePath();
            const number = this.pockets[i];
            if (number === 0 || number === 37) {
                ctx.fillStyle = "#008000";
            }
            else if (this.isRed(number)) {
                ctx.fillStyle = "#DC143C";
            }
            else {
                ctx.fillStyle = "#000000";
            }
            ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1;
            ctx.stroke();
            // Draw number inside pocket
            const textAngle = startAngle + anglePerPocket / 2;
            const textRadius = (innerRadius + outerRadius) / 2;
            ctx.save();
            ctx.rotate(textAngle);
            ctx.fillStyle = "#FFFFFF";
            ctx.font = `bold ${radius / 12}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            const displayNumber = number === 37 ? "00" : number.toString();
            ctx.strokeText(displayNumber, textRadius, 0);
            ctx.fillText(displayNumber, textRadius, 0);
            ctx.restore();
        }
        ctx.restore();
        // Draw 8 metal deflectors (Diamonds)
        const numDiamonds = 8;
        for (let i = 0; i < numDiamonds; i++) {
            const diamondAngle = (i * Math.PI * 2) / numDiamonds + this.currentAngle * 0.5;
            const diamondRadius = radius * 0.98;
            const dx = centerX + Math.cos(diamondAngle) * diamondRadius;
            const dy = centerY + Math.sin(diamondAngle) * diamondRadius;
            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(diamondAngle);
            // Diamond shape
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(0, -4);
            ctx.lineTo(8, 0);
            ctx.lineTo(0, 4);
            ctx.closePath();
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
            grad.addColorStop(0, "#e0e0e0");
            grad.addColorStop(1, "#888888");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = "#444";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    }
    isRed(number) {
        const redNumbers = [
            1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
        ];
        return redNumbers.includes(number);
    }
}
