import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      55,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);

    // Light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    // Table (mesa)
    const tableGeo = new THREE.BoxGeometry(20, 1, 12);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x23304f });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, -0.5, 0);
    scene.add(table);

    // Walls (bordes visuales)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2f3b5f });
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 0.4), wallMat);
    wall1.position.set(0, 0.2, 6.2);
    scene.add(wall1);

    const wall2 = wall1.clone();
    wall2.position.set(0, 0.2, -6.2);
    scene.add(wall2);

    // Paddles (palas)
    const paddleGeo = new THREE.BoxGeometry(1.2, 1, 3);
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0x7aa2ff });

    const leftPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    leftPaddle.position.set(-9, 0.5, 0);
    scene.add(leftPaddle);

    const rightPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    rightPaddle.position.set(9, 0.5, 0);
    scene.add(rightPaddle);

    // Ball (bola)
    const ballGeo = new THREE.SphereGeometry(0.5, 24, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffd166 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(0, 0.6, 0);
    scene.add(ball);

    // Basic animation state (placeholder)
    let t = 0;
    let rafId = 0;

    const animate = () => {
      t += 0.016;
      // Bola haciendo un "∞" suave solo para verificar el loop
      ball.position.x = Math.sin(t) * 4;
      ball.position.z = Math.sin(t * 1.7) * 2.5;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    // Resize handling
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(mountRef.current);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);

      // (No hace falta dispose manual de geometrías/materiales aquí por ser demo,
      // pero lo haréis cuando haya assets dinámicos.)
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}