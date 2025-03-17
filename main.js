// Global variables
let gl;
let shaderProgram;
let texture;
let mesh;
let imageWidth, imageHeight;
let canvas;
let fixedPoints = [];
let meshResolution = 20; // Number of divisions in the mesh
let isDraggingPoint = false;
let draggedPointIndex = -1;
let addingFixedPoint = false;

// Transformation parameters
let rotation = 0;
let scaleX = 1.0;
let scaleY = 1.0;
let translateX = 0;
let translateY = 0;

// Initialize the application
window.onload = function() {
    // Get HTML elements
    canvas = document.getElementById('glCanvas');
    const imageUpload = document.getElementById('imageUpload');
    const resetBtn = document.getElementById('resetBtn');
    const addFixedPointBtn = document.getElementById('addFixedPointBtn');
    const clearFixedPointsBtn = document.getElementById('clearFixedPointsBtn');
    
    // Transformation sliders
    const rotationSlider = document.getElementById('rotationSlider');
    const scaleXSlider = document.getElementById('scaleXSlider');
    const scaleYSlider = document.getElementById('scaleYSlider');
    const translateXSlider = document.getElementById('translateXSlider');
    const translateYSlider = document.getElementById('translateYSlider');
    
    // Display values
    const rotationValue = document.getElementById('rotationValue');
    const scaleXValue = document.getElementById('scaleXValue');
    const scaleYValue = document.getElementById('scaleYValue');
    const translateXValue = document.getElementById('translateXValue');
    const translateYValue = document.getElementById('translateYValue');
    
    // Initialize WebGL
    gl = canvas.getContext('webgl');
    if (!gl) {
        showError('Unable to initialize WebGL. Your browser may not support it.');
        return;
    }
    
    // Event listeners
    imageUpload.addEventListener('change', handleImageUpload);
    resetBtn.addEventListener('click', resetTransformations);
    addFixedPointBtn.addEventListener('click', startAddingFixedPoint);
    clearFixedPointsBtn.addEventListener('click', clearFixedPoints);
    
    // Transformation sliders
    rotationSlider.addEventListener('input', function() {
        rotation = parseFloat(this.value);
        rotationValue.textContent = rotation + '°';
        if (texture) applyDeformation();
    });
    
    scaleXSlider.addEventListener('input', function() {
        scaleX = parseFloat(this.value);
        scaleXValue.textContent = scaleX.toFixed(1);
        if (texture) applyDeformation();
    });
    
    scaleYSlider.addEventListener('input', function() {
        scaleY = parseFloat(this.value);
        scaleYValue.textContent = scaleY.toFixed(1);
        if (texture) applyDeformation();
    });
    
    translateXSlider.addEventListener('input', function() {
        translateX = parseFloat(this.value);
        translateXValue.textContent = translateX + 'px';
        if (texture) applyDeformation();
    });
    
    translateYSlider.addEventListener('input', function() {
        translateY = parseFloat(this.value);
        translateYValue.textContent = translateY + 'px';
        if (texture) applyDeformation();
    });
    
    // Canvas interactions
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseUp); // Stop dragging if mouse leaves canvas
    
    // Initialize shaders
    initShaders();
    
    // Show initial message with animation
    animateCanvasMessage();
};

// Show error message
function showError(message) {
    const canvasMessage = document.getElementById('canvasMessage');
    canvasMessage.textContent = message;
    canvasMessage.style.color = '#dc3545';
    canvasMessage.style.backgroundColor = 'rgba(255, 235, 238, 0.9)';
    canvasMessage.style.border = '1px solid #f5c6cb';
}

// Animate canvas message
function animateCanvasMessage() {
    const canvasMessage = document.getElementById('canvasMessage');
    canvasMessage.style.opacity = '0';
    setTimeout(() => {
        canvasMessage.style.transition = 'opacity 1s ease-in-out';
        canvasMessage.style.opacity = '1';
    }, 100);
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image/png')) {
        showError('Please select a PNG image.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            initializeImage(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Initialize image and WebGL context
function initializeImage(img) {
    // Hide message
    document.getElementById('canvasMessage').style.display = 'none';
    
    // Resize canvas to fit image with some padding
    imageWidth = img.width;
    imageHeight = img.height;
    
    // Calculate canvas size to maintain aspect ratio within container
    const container = document.querySelector('.canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const aspectRatio = imageWidth / imageHeight;
    let canvasWidth = containerWidth;
    let canvasHeight = canvasWidth / aspectRatio;
    
    if (canvasHeight > containerHeight) {
        canvasHeight = containerHeight;
        canvasWidth = canvasHeight * aspectRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Set viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Create texture
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    
    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Create mesh for deformation
    createMesh(meshResolution);
    
    // Reset any previous fixed points
    fixedPoints = [];
    updateFixedPointsList();
    
    // Draw the image
    drawImage();
}

// Initialize shaders
function initShaders() {
    // Vertex shader source
    const vsSource = `
        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        
        varying highp vec2 vTextureCoord;
        
        void main(void) {
            gl_Position = vec4(aVertexPosition, 0.0, 1.0);
            vTextureCoord = aTextureCoord;
        }
    `;
    
    // Fragment shader source
    const fsSource = `
        varying highp vec2 vTextureCoord;
        
        uniform sampler2D uSampler;
        
        void main(void) {
            gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
    `;
    
    // Compile shaders
    const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);
    
    // Create shader program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return;
    }
    
    // Use the shader program
    gl.useProgram(shaderProgram);
    
    // Get attribute locations
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
    
    // Get uniform locations
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, 'uSampler');
}

// Compile shader
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Create a mesh grid for deformation
function createMesh(resolution) {
    const vertices = [];
    const textureCoords = [];
    const indices = [];
    
    mesh = {
        originalVertices: [],
        deformedVertices: [],
        textureCoords: [],
        indices: [],
        resolution: resolution
    };
    
    // Create grid of vertices
    for (let y = 0; y <= resolution; y++) {
        for (let x = 0; x <= resolution; x++) {
            // Normalized coordinates from -1 to 1
            const xPos = (x / resolution) * 2 - 1;
            const yPos = (y / resolution) * 2 - 1;
            
            // Store original vertex positions
            mesh.originalVertices.push(xPos, yPos);
            mesh.deformedVertices.push(xPos, yPos);
            
            // Texture coordinates from 0 to 1
            const texX = x / resolution;
            const texY = 1 - (y / resolution); // Flip Y to match image coordinates
            mesh.textureCoords.push(texX, texY);
        }
    }
    
    // Create triangle indices
    for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
            const topLeft = y * (resolution + 1) + x;
            const topRight = topLeft + 1;
            const bottomLeft = (y + 1) * (resolution + 1) + x;
            const bottomRight = bottomLeft + 1;
            
            // First triangle of quad
            mesh.indices.push(topLeft, bottomLeft, topRight);
            // Second triangle of quad
            mesh.indices.push(topRight, bottomLeft, bottomRight);
        }
    }
    
    // Create WebGL buffers
    mesh.vertexBuffer = gl.createBuffer();
    mesh.textureCoordBuffer = gl.createBuffer();
    mesh.indexBuffer = gl.createBuffer();
    
    // Fill WebGL buffers with initial data
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.deformedVertices), gl.DYNAMIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.textureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.textureCoords), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
}

// Draw the image
function drawImage() {
    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Bind the vertex and texture coordinate buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.textureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    
    // Bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    
    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Draw the triangles
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    
    // Draw fixed points
    drawFixedPoints();
}

// Apply deformation based on current transformation parameters and fixed points
function applyDeformation() {
    // Convert degrees to radians
    const radians = rotation * Math.PI / 180;
    
    // Scale factors
    const sx = scaleX;
    const sy = scaleY;
    
    // Translation (normalized to -1 to 1 range)
    const tx = translateX / (canvas.width / 2);
    const ty = -translateY / (canvas.height / 2); // Flip Y to match WebGL coordinates
    
    // Reset vertices to original positions
    mesh.deformedVertices = [...mesh.originalVertices];
    
    // Apply transformation to all vertices
    for (let i = 0; i < mesh.deformedVertices.length; i += 2) {
        let x = mesh.originalVertices[i];
        let y = mesh.originalVertices[i + 1];
        
        // Apply rotation
        const xRot = x * Math.cos(radians) - y * Math.sin(radians);
        const yRot = x * Math.sin(radians) + y * Math.cos(radians);
        
        // Apply scaling
        const xScaled = xRot * sx;
        const yScaled = yRot * sy;
        
        // Apply translation
        const xFinal = xScaled + tx;
        const yFinal = yScaled + ty;
        
        // Store transformed vertex
        mesh.deformedVertices[i] = xFinal;
        mesh.deformedVertices[i + 1] = yFinal;
    }
    
    // If there are fixed points, apply mesh deformation
    if (fixedPoints.length > 0) {
        applyFixedPointConstraints();
    }
    
    // Update vertex buffer with deformed vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.deformedVertices), gl.DYNAMIC_DRAW);
    
    // Redraw the image
    drawImage();
}

// Apply fixed point constraints using a flexible mesh deformation
function applyFixedPointConstraints() {
    if (fixedPoints.length === 0) return;
    
    // For each fixed point, we need to calculate which vertices it affects
    for (const fixedPoint of fixedPoints) {
        // Convert canvas coordinates to normalized coordinates (-1 to 1)
        const fpNormalizedX = (fixedPoint.canvasX / canvas.width) * 2 - 1;
        const fpNormalizedY = -((fixedPoint.canvasY / canvas.height) * 2 - 1); // Flip Y
        
        // Find the closest vertex index in the original mesh
        let closestVertexIndex = findClosestVertexIndex(fpNormalizedX, fpNormalizedY);
        
        // Ensure the fixed point stays in its original position
        mesh.deformedVertices[closestVertexIndex] = fixedPoint.normalizedX;
        mesh.deformedVertices[closestVertexIndex + 1] = fixedPoint.normalizedY;
        
        // Create a displacement field that smoothly transitions from the fixed point
        for (let i = 0; i < mesh.deformedVertices.length; i += 2) {
            if (i === closestVertexIndex) continue; // Skip the fixed point itself
            
            // Calculate distance between this vertex and the fixed point
            const vx = mesh.originalVertices[i];
            const vy = mesh.originalVertices[i + 1];
            const dx = vx - fixedPoint.normalizedX;
            const dy = vy - fixedPoint.normalizedY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate influence factor based on distance (inverse square falloff)
            const maxDistance = 2.0; // Max influence distance
            const influence = Math.max(0, 1 - Math.min(distance / maxDistance, 1));
            const influenceSquared = influence * influence;
            
            // Calculate displacement from transformed position back to original position
            const dxTransformed = mesh.deformedVertices[i] - mesh.originalVertices[i];
            const dyTransformed = mesh.deformedVertices[i + 1] - mesh.originalVertices[i + 1];
            
            // Adjust vertex position based on influence
            mesh.deformedVertices[i] -= dxTransformed * influenceSquared;
            mesh.deformedVertices[i + 1] -= dyTransformed * influenceSquared;
        }
    }
}

// Find the index of the closest vertex to a point
function findClosestVertexIndex(x, y) {
    let closestIndex = 0;
    let closestDistance = Number.MAX_VALUE;
    
    for (let i = 0; i < mesh.originalVertices.length; i += 2) {
        const vx = mesh.originalVertices[i];
        const vy = mesh.originalVertices[i + 1];
        const dx = vx - x;
        const dy = vy - y;
        const distance = dx * dx + dy * dy;
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
        }
    }
    
    return closestIndex;
}

// Draw fixed points as colored circles
function drawFixedPoints() {
    // This function draws the fixed points using HTML canvas 2D context
    // We're not using WebGL for this simple overlay
    const ctx = canvas.getContext('2d');
    
    // Temporarily disable WebGL to allow canvas 2D drawing
    gl.flush();
    
    // Draw each fixed point
    for (let i = 0; i < fixedPoints.length; i++) {
        const point = fixedPoints[i];
        
        // Draw shadow
        ctx.beginPath();
        ctx.arc(point.canvasX, point.canvasY, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
        
        // Draw point
        ctx.beginPath();
        ctx.arc(point.canvasX, point.canvasY, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(247, 37, 133, 0.8)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.font = '14px Poppins, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(i + 1, point.canvasX, point.canvasY + 24);
        
        // Draw outline with shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeText(i + 1, point.canvasX, point.canvasY + 24);
    }
    
    // Re-enable WebGL rendering for next frame
    gl = canvas.getContext('webgl');
}

// Handle mouse down on canvas
function handleCanvasMouseDown(event) {
    if (!texture) return; // Do nothing if no image is loaded
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    if (addingFixedPoint) {
        // Add a new fixed point at the clicked position
        addFixedPoint(canvasX, canvasY);
        addingFixedPoint = false;
        addFixedPointBtn.textContent = 'Add Fixed Point';
    } else {
        // Check if user clicked on an existing fixed point
        const clickedPointIndex = findClickedFixedPoint(canvasX, canvasY);
        if (clickedPointIndex !== -1) {
            isDraggingPoint = true;
            draggedPointIndex = clickedPointIndex;
        }
    }
}

// Handle mouse move on canvas
function handleCanvasMouseMove(event) {
    if (!isDraggingPoint) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Update dragged fixed point position
    updateFixedPointPosition(draggedPointIndex, canvasX, canvasY);
    
    // Apply deformation with updated fixed point
    applyDeformation();
}

// Handle mouse up on canvas
function handleCanvasMouseUp(event) {
    isDraggingPoint = false;
    draggedPointIndex = -1;
}

// Add a new fixed point
function addFixedPoint(canvasX, canvasY) {
    const normalizedX = (canvasX / canvas.width) * 2 - 1;
    const normalizedY = -((canvasY / canvas.height) * 2 - 1); // Flip Y to match WebGL coordinates
    
    fixedPoints.push({
        canvasX: canvasX,
        canvasY: canvasY,
        normalizedX: normalizedX,
        normalizedY: normalizedY
    });
    
    updateFixedPointsList();
    applyDeformation();
}

// Update fixed point position
function updateFixedPointPosition(index, canvasX, canvasY) {
    if (index < 0 || index >= fixedPoints.length) return;
    
    fixedPoints[index].canvasX = canvasX;
    fixedPoints[index].canvasY = canvasY;
    
    // Update normalized coordinates
    fixedPoints[index].normalizedX = (canvasX / canvas.width) * 2 - 1;
    fixedPoints[index].normalizedY = -((canvasY / canvas.height) * 2 - 1); // Flip Y
    
    updateFixedPointsList();
}

// Find if user clicked on a fixed point
function findClickedFixedPoint(canvasX, canvasY) {
    const hitRadius = 10; // Radius in pixels for hit detection
    
    for (let i = 0; i < fixedPoints.length; i++) {
        const point = fixedPoints[i];
        const dx = point.canvasX - canvasX;
        const dy = point.canvasY - canvasY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= hitRadius) {
            return i;
        }
    }
    
    return -1;
}

// Update the fixed points list in the UI
function updateFixedPointsList() {
    const listContainer = document.getElementById('fixedPointsList');
    listContainer.innerHTML = '';
    
    for (let i = 0; i < fixedPoints.length; i++) {
        const point = fixedPoints[i];
        const listItem = document.createElement('div');
        listItem.className = 'fixed-point-item';
        
        const pointText = document.createElement('span');
        pointText.textContent = `Point ${i + 1}: (${Math.round(point.canvasX)}, ${Math.round(point.canvasY)})`;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = function() {
            removeFixedPoint(i);
        };
        
        listItem.appendChild(pointText);
        listItem.appendChild(removeBtn);
        listContainer.appendChild(listItem);
    }
}

// Remove a fixed point
function removeFixedPoint(index) {
    fixedPoints.splice(index, 1);
    updateFixedPointsList();
    applyDeformation();
}

// Start adding a fixed point
function startAddingFixedPoint() {
    addingFixedPoint = !addingFixedPoint;
    
    const addFixedPointBtn = document.getElementById('addFixedPointBtn');
    if (addingFixedPoint) {
        addFixedPointBtn.textContent = 'Click on image to place point';
        addFixedPointBtn.style.backgroundColor = '#4cc9f0';
        canvas.style.cursor = 'crosshair';
    } else {
        addFixedPointBtn.textContent = 'Add Fixed Point';
        addFixedPointBtn.style.backgroundColor = '';
        canvas.style.cursor = 'default';
    }
}

// Clear all fixed points
function clearFixedPoints() {
    fixedPoints = [];
    updateFixedPointsList();
    applyDeformation();
}

// Reset transformations
function resetTransformations() {
    // Reset parameters
    rotation = 0;
    scaleX = 1.0;
    scaleY = 1.0;
    translateX = 0;
    translateY = 0;
    
    // Reset sliders
    document.getElementById('rotationSlider').value = rotation;
    document.getElementById('scaleXSlider').value = scaleX;
    document.getElementById('scaleYSlider').value = scaleY;
    document.getElementById('translateXSlider').value = translateX;
    document.getElementById('translateYSlider').value = translateY;
    
    // Reset display values
    document.getElementById('rotationValue').textContent = rotation + '°';
    document.getElementById('scaleXValue').textContent = scaleX.toFixed(1);
    document.getElementById('scaleYValue').textContent = scaleY.toFixed(1);
    document.getElementById('translateXValue').textContent = translateX + 'px';
    document.getElementById('translateYValue').textContent = translateY + 'px';
    
    // Apply reset transformation
    if (texture) applyDeformation();
} 