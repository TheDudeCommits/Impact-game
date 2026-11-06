import * as T from 'three';
import {expect,it}from'vitest';
import {applyHagureCosmicLook}from'../src/render/signature/HagureCosmicLook';
import {addShaderPatch,shaderPatchKeys}from'../src/render/look/shaderPatch';

it('preserves base Hagure and every other fighter/material',()=>{
 for(const[id,form,name,map]of[['hagure',false,'Cosmic',true],['taisei',true,'Cosmic',true],['hagure',true,'Pants',true],['hagure',true,'Cosmic',false]]as const){
  const material=new T.MeshToonMaterial({map:map?new T.Texture():null});material.name=name;
  expect(applyHagureCosmicLook(material,id,form)).toBe(false);expect(shaderPatchKeys(material)).toEqual([]);material.map?.dispose();material.dispose();
 }
});
it('retains the native mapped texture after ink without replacing existing edits or stacking',()=>{
 const texture=new T.Texture(),material=new T.MeshToonMaterial({map:texture});material.name='Cosmic';
 addShaderPatch(material,'prior-ink',shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight *= .1;\n#include <opaque_fragment>').replace('#include <premultiplied_alpha_fragment>','gl_FragColor.rgb = vec3(0.); // cinematic silhouette\n#include <premultiplied_alpha_fragment>');});
 expect(applyHagureCosmicLook(material,'hagure',true)).toBe(true);applyHagureCosmicLook(material,'hagure',true);
 const shader={uniforms:{},vertexShader:T.ShaderLib.toon.vertexShader,fragmentShader:T.ShaderLib.toon.fragmentShader}as unknown as T.WebGLProgramParametersWithUniforms;
 material.onBeforeCompile(shader,{}as T.WebGLRenderer);
 expect(shaderPatchKeys(material)).toEqual(['prior-ink','hagure-native-cosmic-texture-v2']);
 expect(shader.fragmentShader.indexOf('outgoingLight *= .1')).toBeLessThan(shader.fragmentShader.indexOf('gl_FragColor.rgb = max('));
 expect(shader.fragmentShader.indexOf('// cinematic silhouette')).toBeLessThan(shader.fragmentShader.indexOf('gl_FragColor.rgb = max('));
 expect(shader.fragmentShader.match(/texture2D\(map, vMapUv\)/g)).toHaveLength(1);
 expect(material.map).toBe(texture);expect(material.emissiveMap).toBeNull();expect(material.emissiveIntensity).toBe(1);
 const uniform=shader.uniforms.hagureNativeTextureFloor;expect(uniform.value).toBe(4);applyHagureCosmicLook(material,'hagure',true,1);expect(uniform.value).toBe(1);applyHagureCosmicLook(material,'hagure',true,8);expect(uniform.value).toBe(4);
 texture.dispose();material.dispose();
});
