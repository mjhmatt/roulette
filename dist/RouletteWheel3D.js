import * as THREE from 'three';
export class RouletteWheel3D {
    constructor() {
        this.pockets = [
            0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37,
            27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
        ];
        this.currentAngle = 0;
        this.rotationSpeed = 0;
        this.friction = 0.9985; // Heavy professional wheel friction
        this.mesh = new THREE.Group();
        this.innerGroup = new THREE.Group();
        this.mesh.add(this.innerGroup);
        this.createWheel();
    }
    createWheel() {
        const radius = 5;
        const tubeRadius = 0.5;
        // Outer bowl/rim
        const bowlGeom = new THREE.CylinderGeometry(radius * 1.1, radius * 0.8, 1.5, 64, 1, true);
        const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide });
        const bowl = new THREE.Mesh(bowlGeom, bowlMat);
        bowl.position.y = 0.5;
        this.mesh.add(bowl);
        // Center hub (silver/chrome)
        const hubGeom = new THREE.CylinderGeometry(1.2, 1.2, 1, 32);
        const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
        const hub = new THREE.Mesh(hubGeom, hubMat);
        hub.position.y = 0.5;
        this.innerGroup.add(hub);
        // Pockets
        const anglePerPocket = (Math.PI * 2) / this.pockets.length;
        for (let i = 0; i < this.pockets.length; i++) {
            const angle = i * anglePerPocket;
            const pocketGroup = new THREE.Group();
            // Pocket Floor
            const pocketGeom = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.2, 32, 1, false, angle, anglePerPocket);
            const num = this.pockets[i];
            const color = num === 0 || num === 37 ? 0x008000 : (this.isRed(num) ? 0xdc143c : 0x000000);
            const pocketMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.2, roughness: 0.8 });
            const pocket = new THREE.Mesh(pocketGeom, pocketMat);
            pocketGroup.add(pocket);
            // Pocket Number Text (using a simple plane with canvas texture for better performance)
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = num === 0 || num === 37 ? '#008000' : (this.isRed(num) ? '#dc143c' : '#000000');
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num === 37 ? '00' : num.toString(), 32, 32);
            const texture = new THREE.CanvasTexture(canvas);
            const labelGeom = new THREE.PlaneGeometry(0.6, 0.6);
            const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            const label = new THREE.Mesh(labelGeom, labelMat);
            label.position.set(Math.cos(angle + anglePerPocket / 2) * radius * 0.7, 0.11, Math.sin(angle + anglePerPocket / 2) * radius * 0.7);
            label.rotation.x = -Math.PI / 2;
            label.rotation.z = -(angle + anglePerPocket / 2 + Math.PI / 2);
            this.innerGroup.add(label);
            this.innerGroup.add(pocketGroup);
        }
        // Diamonds (deflectors)
        for (let i = 0; i < 8; i++) {
            const diamondAngle = (i * Math.PI * 2) / 8;
            const diamondGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
            const diamondMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.1 });
            const diamond = new THREE.Mesh(diamondGeom, diamondMat);
            diamond.position.set(Math.cos(diamondAngle) * radius * 1.0, 1.0, Math.sin(diamondAngle) * radius * 1.0);
            this.mesh.add(diamond);
        }
    }
    isRed(num) {
        const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        return reds.includes(num);
    }
    spin(speed) {
        this.rotationSpeed = speed;
    }
    update() {
        this.currentAngle += this.rotationSpeed;
        this.rotationSpeed *= this.friction;
        this.innerGroup.rotation.y = -this.currentAngle;
    }
}
