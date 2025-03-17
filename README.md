# Image Deformer

A web-based application that allows users to deform images using WebGL, similar to Live2D and Spline 2D. The application supports transformations like translation, rotation, and scaling while allowing users to set fixed points that remain in place during deformation.

## Features

- PNG image upload via file selection dialog
- Image transformation controls (rotation, scaling, translation)
- Fixed point support - pin parts of your image in place during transformations
- Real-time deformation preview
- Mesh-based deformation system for flexible material simulation

## How to Use

1. Open `index.html` in a modern web browser that supports WebGL
2. Upload a PNG image using the file selection button
3. Use the sliders to apply transformations:
   - Rotation: Rotate the image around its center
   - Scale X/Y: Scale the image horizontally or vertically
   - Translate X/Y: Move the image horizontally or vertically
4. Add fixed points to pin parts of the image:
   - Click "Add Fixed Point" and then click on the part of the image you want to fix
   - Fixed points will remain in their original position when transformations are applied
   - The surrounding areas will deform smoothly
5. Drag existing fixed points to reposition them
6. Use the "Reset" button to clear all transformations
7. Use "Clear Fixed Points" to remove all fixed points

## Technical Details

The application uses:
- HTML5 for the interface
- WebGL (version 1) for rendering and deformation
- JavaScript for logic and user interaction
- Canvas API for drawing fixed points

The deformation is achieved by creating a mesh grid and applying transformations to each vertex while respecting fixed point constraints.

## Requirements

- Web browser with WebGL support
- For best performance, use the latest version of Chrome, Firefox, or Edge 
