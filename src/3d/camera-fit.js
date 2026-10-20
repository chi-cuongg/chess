import * as THREE from 'three';

// Fit every corner, including the near edge enlarged by perspective.
export function fitBoardCamera(camera, bounds, preset, padding = 1.08) {
    const target = new THREE.Vector3(...preset.target);
    const direction = new THREE.Vector3(...preset.position).sub(target).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanX = tanY * camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
                const point = new THREE.Vector3(x, y, z).sub(target);
                const near = point.dot(direction);
                distance = Math.max(distance, near + padding * Math.abs(point.dot(right)) / tanX,
                    near + padding * Math.abs(point.dot(up)) / tanY);
            }
        }
    }
    return { position: target.clone().addScaledVector(direction, distance).toArray(), target: target.toArray() };
}
