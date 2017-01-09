(function (THREE) {

    'use strict';

    // -------------------------------------------------------
    // VR用に利用する変数
    let vrDisplay = null;
    let pose      = null;
    let layer     = null;

    let vrFrameData    = new VRFrameData();
    let standingMatrix = new THREE.Matrix4();

	let leftBounds  = null;
	let rightBounds = null;

    let cameraL = new THREE.PerspectiveCamera();
    cameraL.layers.enable(1);

    let cameraR = new THREE.PerspectiveCamera();
    cameraR.layers.enable(2);

    let eyeTranslationL = new THREE.Vector3();
    let eyeTranslationR = new THREE.Vector3();
    let renderRectL, renderRectR;
    // -------------------------------------------------------


    let width  = window.innerWidth;
    let height = window.innerHeight;

    // Camera
    let camera  = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.name = 'camera';

    // Renderer
    let renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000);
    document.body.appendChild(renderer.domElement);

    // Box(Cube)
    let geo = new THREE.BoxGeometry(1, 1, 1);
    let mat = new THREE.MeshLambertMaterial({
        color: 0xff0000
    });
    let box = new THREE.Mesh(geo, mat);
    box.name = 'box';
    box.position.set(0, 0, -10);

    // Lights
    let light = new THREE.DirectionalLight(0xffffff);
    light.name = 'light';
    light.position.set(10, 10, 10);

    let ambient = new THREE.AmbientLight(0x444444);
    ambient.name = 'ambient light';

    // Scene
    let scene = new THREE.Scene();
    scene.add(camera);
    scene.add(box);
    scene.add(light);
    scene.add(ambient);

    // Three.js inspector用にグローバルに参照できるよう外に出す
    window.scene = scene;

    // VRDisplayの取得
    navigator.getVRDisplays().then((displays) => {
        if (displays.length === 0) {
            console.error('HMD not found.');
            return;
        }

        vrDisplay = displays[0];

        onFrame();
    });

    // アニメーションループ
    const onFrame = () => {

        if (!vrDisplay) {
            return;
        }

        // カメラの姿勢のupdate
        vrDisplay.getFrameData(vrFrameData); 
        pose = vrFrameData.pose;

        if (pose.orientation !== null) {
            camera.quaternion.fromArray(pose.orientation);
        }
        if (pose.position !== null) {
            camera.position.fromArray(pose.position);
        }

        if (vrDisplay.stageParameters) {
            camera.updateMatrix();
            standingMatrix.fromArray(vrDisplay.stageParameters.sittingToStandingTransform);
            camera.applyMatrix(standingMatrix);
        }

        if (vrDisplay.requestAnimationFrame) {
            vrDisplay.requestAnimationFrame(onFrame);
        }
        else {
            requestAnimationFrame(onFrame);
        }

        if (vrDisplay.isPresenting) {
            renderForVR();
        }
        else {
            renderForNormal();
        }

        box.rotation.x += 0.01;
    };

    // 通常モードのレンダリング
    const renderForNormal = () => {
        renderer.render(scene, camera);
    };

    // VRモードのレンダリング
    const renderForVR = () => {
        let eyeParamsL = vrDisplay.getEyeParameters('left');
        let eyeParamsR = vrDisplay.getEyeParameters('right');

        eyeTranslationL.fromArray(eyeParamsL.offset);
        eyeTranslationR.fromArray(eyeParamsR.offset);

        let size = renderer.getSize();

        renderRectL = {
            x: Math.round(size.width * leftBounds[0]),
            y: Math.round(size.height * leftBounds[1]),
            width : Math.round(size.width * leftBounds[2]),
            height: Math.round(size.height * leftBounds[3])
        };

        renderRectR = {
            x: Math.round(size.width * rightBounds[0]),
            y: Math.round(size.height * rightBounds[1]),
            width : Math.round(size.width * rightBounds[2]),
            height: Math.round(size.height * rightBounds[3])
        };

        renderer.setScissorTest(true);

        camera.matrixWorld.decompose(cameraL.position, cameraL.quaternion, cameraL.scale);
        camera.matrixWorld.decompose(cameraR.position, cameraR.quaternion, cameraR.scale);

        cameraL.translateOnAxis(eyeTranslationL, 1.0);
        cameraR.translateOnAxis(eyeTranslationR, 1.0);

        vrDisplay.depthNear = camera.near;
        vrDisplay.depthFar = camera.far;

        vrDisplay.getFrameData(vrFrameData);

        cameraL.projectionMatrix.elements = vrFrameData.leftProjectionMatrix;
        cameraR.projectionMatrix.elements = vrFrameData.rightProjectionMatrix;

        // 左目のレンダリング
        renderer.setViewport(renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height);
        renderer.setScissor(renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height);
        renderer.render(scene, cameraL);

        // 右目のレンダリング
        renderer.setViewport(renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height);
        renderer.setScissor(renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height);
        renderer.render(scene, cameraR);

        renderer.setScissorTest(false);

        vrDisplay.submitFrame();
    };

    // Clickしたら開始
    document.addEventListener('click', () => {
        if (!vrDisplay) {
            return;
        } 

        if (vrDisplay.isPresenting) {
            return;
        }

        vrDisplay.requestPresent([{source: renderer.domElement}]);
    }, false);

    // HMDに表示されたら画面を分割
    window.addEventListener('vrdisplaypresentchange', () => {
        let layers = vrDisplay.getLayers();
        layer = layers[0];

        leftBounds = layer.leftBounds !== null && layer.leftBounds.length === 4 ? layer.leftBounds : [0.0, 0.0, 0.5, 1.0];
        rightBounds = layer.rightBounds !== null && layer.rightBounds.length === 4 ? layer.rightBounds : [0.5, 0.0, 0.5, 1.0];
    }, false);

}(THREE));