// Shared component graphics for the node editor and the style gallery.
(function(root) {
  root.FlangeComponentVisuals = {
    styles: [
  {id:'paper',name:'Креслення',desc:'Прямі проєкції, осьові лінії та розміри для читання геометрії.'},
  {id:'passport',name:'Гібридний паспорт',desc:'Поєднання вигляду, перерізу й виносного елемента.'}
],
    assembly(parts,fastener,scope) {
      const profile = root.PassportProfiles;
      const {bolt} = fastener;
      const d = fastener.diameter > 0 && (fastener.pitch || parts.some(p=>p.height > 0 && p.kind === 'nut' || p.h > 0 && p.kind === 'washer')) ? fastener.diameter : 24;
      const bounded = (value,min,max) => Math.max(min,Math.min(value,max));
      const shaftRadius = 18, gap = shaftRadius + 2, mm = 2*shaftRadius/d;
      const {shankRadius,headRadius,headHeight} = profile.boltMetrics(d);
      const scale = shaftRadius/shankRadius;
      const hole = fastener.axialHole > 0 && fastener.axialHole < d ? shankRadius*fastener.axialHole/d : 0;
      const steel = 'assembly-steel-'+scope, hatch = 'assembly-hatch-'+scope;
      const nutHatch = 'assembly-nut-'+scope, gasketHatch = 'assembly-gasket-'+scope;
      const gasket = parts.find(p=>p.kind === 'gasket');
      const sides = parts.filter(p=>p.kind === 'side').map(part=>{
        const f = part.flange;
        const sized = f && f.outerDiameter > f.boltCircle && f.boltCircle > f.innerDiameter && f.innerDiameter > 0;
        const rim = sized ? bounded((f.outerDiameter-f.boltCircle)*mm/2,36,62) : 45;
        const bore = sized ? bounded((f.boltCircle-f.innerDiameter)*mm/2,76,140) : 112;
        const wall = bounded((f?.wallCylinder || 10)*mm,10,bore-52);
        const closedPart = ['cover','body'].includes(part.role);
        const hasCone = f?.form ? f.form === 'conical' : closedPart && !f ? false : f?.coneHeight !== 0;
        const cone = hasCone ? bounded((f?.coneHeight || 42)*mm,20,74) : 0;
        const rootWall = bounded(f?.wallCone > 0 ? f.wallCone*mm : wall+25,wall,bore-39);
        return {part,f,sized,rim,bore,wall,cone,rootWall};
      });
      const ref = sides.find(s=>s.sized);
      const circular = sides.some(s=>['cover','body','flange'].includes(s.part.role) || s.part.flanged);
      const centerX = Math.max(...sides.map(s=>s.bore))+50;
      function radialX(diameter,fallback) {
        if (!ref || !(diameter > 0)) return fallback;
        const f = ref.f, delta = f.boltCircle-diameter;
        return delta < 0 ? delta*ref.rim/(f.outerDiameter-f.boltCircle) : delta*ref.bore/(f.boltCircle-f.innerDiameter);
      }
      const seatEnd = Math.min(...sides.map(s=>s.bore));
      const seatStart = bounded(radialX(gasket.outer,seatEnd-36),gap+4,seatEnd-9);
      const gasketEnd = bounded(radialX(gasket.inner,seatEnd),gasket.full ? gap+6 : seatStart+5,seatEnd);
      const gasketLeft = bounded(radialX(gasket.outer,-40),-Math.min(...sides.map(s=>s.rim)),-gap-3);
      const faceStep = gasket.full ? 0 : 4;
      const shapes = [], markers = [];
      let y = 0, minY = 0, maxY = 0, shaftTop, shaftBottom;
      let nutScale = 1, threadLength = shaftRadius, headBelow = false;
      const previousLabel = {left:-Infinity,right:-Infinity};
      function mark(index,edge,level,right=false) {
        const column = right ? 'right' : 'left';
        const x = right ? (circular ? centerX+30 : 165) : -87;
        const labelY = Math.max(level,previousLabel[column]+19);
        previousLabel[column] = labelY;
        maxY = Math.max(maxY,labelY+9);
        markers.push(`<path d="M ${edge} ${level} L ${x+(right ? -17 : 17)} ${labelY} H ${x}" fill="none" stroke="#006d73" stroke-width=".8"/>
          <circle cx="${x}" cy="${labelY}" r="7.5" fill="#f7faf9" stroke="#006d73"/>
          <text x="${x}" y="${labelY+3.2}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#005f66">${index+1}</text>`);
      }
      function strip(left,right,top,thickness,fill) {
        return `<rect x="${left}" y="${top}" width="${right-left}" height="${thickness}" fill="url(#${fill})"/>`;
      }
      function breakLine(x1,y1,x2,y2) {
        const dx = x2-x1, dy = y2-y1, length = Math.hypot(dx,dy);
        let line = '';
        for (let step=1; step<=4; step++) {
          const middle = (step-.5)/4, end = step/4, bend = step%2 ? 6 : -6;
          line += ` Q ${x1+dx*middle-dy/length*bend} ${y1+dy*middle+dx/length*bend} ${x1+dx*end} ${y1+dy*end}`;
        }
        return line;
      }
      for (const [index,part] of parts.entries()) {
        let thickness, edge;
        if (part.kind === 'side') {
          const {f,rim,bore,wall,cone,rootWall} = sides.find(s=>s.part===part);
          const dir = part.upper ? -1 : 1;
          thickness = bounded((part.thickness || 36)*mm,31,78);
          const face = part.upper ? y+thickness : y;
          const deck = thickness, tapped = part.tapped;
          const throat = tapped ? shaftRadius-.5 : bounded((f?.holeDiameter || 0)*mm/2,gap,Math.min(rim-7,bore-46));
          // Від ущільнювальної площини до зовнішнього торця, у місцевих координатах деталі.
          let back = `H ${bore}`;
          const cover = part.role === 'cover', body = part.role === 'body';
          let sectionEnd = deck;
          const coverEnd = centerX-20;
          if (cover) {
            sectionEnd = deck+cone;
            back = cone ? `H ${bore-rootWall} L ${bore-wall} ${sectionEnd} H ${coverEnd}` : `H ${coverEnd}`;
          } else if (body) {
            back = breakLine(tapped ? -rim : throat,deck,bore,deck);
          } else if (part.flanged) {
            const foot = bore-(cone ? rootWall : wall), neck = bore-wall;
            const end = deck+cone+29;
            sectionEnd = end;
            back = `H ${foot-3} Q ${foot} ${deck} ${foot} ${deck+3} L ${neck} ${deck+Math.max(3,cone)} V ${end}
              q ${wall*.25} -2 ${wall*.5} 0 t ${wall*.5} 0`;
            minY = Math.min(minY,face+dir*end);
            maxY = Math.max(maxY,face+dir*end);
          }
          minY = Math.min(minY,face+dir*sectionEnd);
          maxY = Math.max(maxY,face+dir*sectionEnd);
          const innerEdge = cover ? breakLine(coverEnd,sectionEnd,coverEnd,0) : 'V 0';
          const rightFace = faceStep ? `${innerEdge} H ${Math.max(seatStart,throat)} V ${faceStep} H ${throat}` : `${innerEdge} H ${throat}`;
          let outline;
          if (tapped) {
            const ratio = part.engagement > 0 && part.memberHeight > 0 ? part.engagement/part.memberHeight : .72;
            const depth = bounded(thickness*ratio,faceStep+6,thickness-6);
            const tip = face+dir*depth;
            if (part.upper) shaftTop = tip;
            else shaftBottom = tip;
            threadLength = Math.max(threadLength,depth);
            // Умовний обрив отвору за кінцем кріплення: глибину свердління анкета не задає.
            outline = `M ${-rim} ${deck} ${back} ${rightFace} V ${depth+3} q ${-throat*.5} 2 ${-throat} 0 t ${-throat} 0 V ${faceStep} H ${-rim} Z`;
          } else {
            const leftBack = body ? breakLine(-rim,deck,-throat,deck) : `H ${-throat}`;
            outline = `M ${-rim} ${deck} ${leftBack} V ${faceStep} H ${-rim} Z M ${throat} ${deck} ${back} ${rightFace} Z`;
          }
          const selected = fastener.activeSide === part.side;
          const neckEnd = sectionEnd;
          let trace = '';
          if (selected && fastener.dimension) {
            const [section,,key] = fastener.dimension.split('.');
            const foot = bore-(cone ? rootWall : wall);
            const features = {
              innerDiameter:cover ? `M ${bore} 0 V ${deck}` : `M ${bore} 0 V ${neckEnd}`,
              outerDiameter:`M ${-rim} ${faceStep} V ${deck}`,
              boltCircle:`M 0 ${faceStep} V ${deck}`,
              holeDiameter:`M ${-throat} ${deck/2} H ${throat}`,
              height:`M ${bore-rootWall*.5} 0 V ${deck}`,
              coneHeight:body ? '' : `M ${foot} ${deck} L ${bore-wall} ${deck+cone}`,
              wallCylinder:`M ${bore-wall} ${body ? deck/2 : cover ? sectionEnd : deck+cone+15} H ${bore}`,
              wallCone:`M ${bore-rootWall} ${deck} H ${bore}`,
              gasketDiameter:`M ${radialX(f?.gasketDiameter,seatStart)} -3 V ${faceStep+3}`
            };
            trace = section === 'connection' && key === 'height' ? `M ${-rim+4} ${faceStep} V ${deck}` : features[key] || '';
          }
          shapes.push(`<g data-assembly-side="${part.side}" data-part-role="${part.role || 'part'}" transform="translate(0 ${face}) scale(1 ${dir})" opacity="${fastener.activeSide && !selected ? .55 : 1}">
            <path d="${outline}" fill="url(#${hatch})" stroke="none"/>
            <path d="${outline}" fill="none"/>
            ${selected ? `<path d="${outline}" fill="#0d9488" fill-opacity=".12" stroke="none"/><path class="assembly-selection" d="${outline}" fill="none" stroke="#087d81" stroke-width="1.8"/>` : ''}
            ${trace ? `<path class="assembly-dimension" d="${trace}" fill="none" stroke="#d4822f" stroke-width="2"/>` : ''}
          </g>`);
          edge = -rim;
        } else if (part.kind === 'head') {
          thickness = headHeight*scale;
          const seat = part.upper ? y+thickness : y;
          headBelow = !part.upper;
          if (part.upper) shaftTop = seat;
          else shaftBottom = seat;
          shapes.push(`<g class="assembly-fastener" transform="translate(0 ${seat}) scale(${scale} ${part.upper ? scale : -scale})">
            ${profile.boltHead(0,-headHeight,headRadius,0,steel)}
            ${hole ? `<path d="M ${-hole} ${-headHeight} V 0 M ${hole} ${-headHeight} V 0" fill="none" stroke-dasharray="4 3"/>` : ''}</g>`);
          edge = -headRadius*scale;
        } else if (part.kind === 'nut') {
          const h = part.height || d;
          const nut = profile.buildHexNutMetrics(0,0,d,part.capped ? 'B' : 'A',{nutM:h,nutCapH:h,nutS:part.acrossFlats,pitch:fastener.pitch || 2});
          nutScale = shaftRadius/(nut.threadRadius+2);
          thickness = nut.hPx*nutScale;
          const seat = part.upper ? y+thickness : y;
          const reach = part.capped ? thickness*.5 : thickness+12;
          threadLength = Math.max(threadLength,reach);
          if (part.upper) shaftTop = seat-reach;
          else shaftBottom = seat+reach;
          shapes.push(`<g class="assembly-fastener" transform="translate(0 ${seat}) scale(${nutScale} ${part.upper ? nutScale : -nutScale})">${profile.nutSide(nut,steel,nutHatch)}</g>`);
          edge = -(nut.cap ? nut.cap.bodyDiameterMm * nut.scale / 2 : nut.halfE)*nutScale;
        } else if (part.kind === 'gasket') {
          thickness = bounded((part.thickness || 3)*mm,4,13);
          if (part.full) shapes.push(strip(gasketLeft,-gap,y,thickness,gasketHatch));
          shapes.push(strip(part.full ? gap : seatStart,gasketEnd,y,thickness,gasketHatch));
          edge = gasketEnd;
        } else if (part.kind === 'washer') {
          thickness = part.h > 0 ? part.h*mm : 4;
          const outer = part.outer > 0 ? part.outer*mm/2 : 40;
          const inner = part.inner > 0 ? part.inner*mm/2 : gap;
          shapes.push(strip(-outer,-inner,y,thickness,steel),strip(inner,outer,y,thickness,steel));
          if (part.spring) shapes.push(`<path d="M ${inner+(outer-inner)*.35} ${y} l ${(outer-inner)*.3} ${thickness}" fill="none"/>`);
          edge = -outer;
        } else {
          thickness = bounded((part.thickness || 12)*mm,8,28);
          shapes.push(strip(-45,-gap,y,thickness,hatch),strip(gap,seatEnd,y,thickness,hatch));
          edge = -45;
        }
        mark(index,edge,y+thickness/2,part.kind === 'gasket');
        y += thickness;
      }
      const length = (shaftBottom-shaftTop)/scale;
      const shaft = profile.buildFastenerGeometry(0,0,length,shankRadius,fastener.pitch || 2,Math.min((threadLength+8)/scale,length*(bolt ? .85 : .47)),!bolt);
      const axisTop = Math.min(0,shaftTop)-12, axisBottom = Math.max(y,shaftBottom)+12;
      minY = Math.min(minY,axisTop)-9;
      maxY = Math.max(maxY,axisBottom)+9;
      return `<svg viewBox="-100 ${minY} ${circular ? centerX+145 : 280} ${maxY-minY}" role="img" aria-label="Осьовий розріз з’єднання через кріплення і прокладку">
        <defs>${profile.steelGradient(steel)}${profile.steelHatch(nutHatch,.65/nutScale)}${profile.steelHatch(hatch,1)}
          <pattern id="${gasketHatch}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#526269"/><path d="M0 0L4 4M0 4L4 0" stroke="#c4d0d4" stroke-width=".55"/></pattern></defs>
        <g stroke="#2b434f" stroke-width="1.35" stroke-linejoin="round">
          <g class="assembly-fastener" transform="translate(0 ${headBelow ? shaftBottom : shaftTop}) scale(${headBelow ? -scale : scale})">
            <path d="${shaft.bodyPath}" fill="url(#${steel})" stroke-width="2"/>
            <path d="${shaft.threadLines}" fill="none" stroke="#3c5866" stroke-width=".85"/>
            ${hole ? `<path d="M ${-hole} 0 V ${length} M ${hole} 0 V ${length}" fill="none" stroke-dasharray="4 3"/>` : ''}</g>
          ${shapes.join('')}</g>
        <g fill="none" stroke="#c56b1a" stroke-width=".85" stroke-dasharray="12 4 2 4">
          <path data-axis="fastener" d="M 0 ${axisTop} V ${axisBottom}"/>
          ${circular ? `<path data-axis="joint" d="M ${centerX} ${minY+2} V ${maxY-2}"/>` : ''}</g>${markers.join('')}</svg>`;
    },
    create(style,key,part,threadPitch) {
      const parts = {[key]:part};
      const d=part.diameter || part.outer;
      const pitch=threadPitch;
      const number=n=>n.toLocaleString('uk-UA',{maximumFractionDigits:2});
      const styles=this.styles;
const TAU = Math.PI*2;
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));

// A meridian swept around the vertical axis. The thread radius also varies with angle.
function surface(part,key,cut) {
  const rows=[], triangles=[], n=120;
  const r=part.outer/2, hole=part.inner/2, h=part.h;
  const begin=cut ? -Math.PI*.28 : 0, span=cut ? Math.PI*1.49 : TAU;
  const hex=a => r*Math.cos(Math.PI/6)/Math.cos(((a+TAU+Math.PI/6)%(Math.PI/3))-Math.PI/6);
  function threadDepth(z,a) {
    const phase=((z/pitch-a/TAU)%1+1)%1;
    return clamp((Math.abs(phase-.5)-.07)*2.75,0,1);
  }
  function outside(z,a) {
    if(key==='nut') return Math.min(hex(a),r*.84+Math.min(z,h-z)*1.6);
    if(key==='stud') {
      const threaded=clamp(Math.max((h*.31-z)/pitch,(z-h*.70)/pitch),0,1);
      return Math.min(r*.88+Math.min(z,h-z)*1.3,r-1.65*threaded*threadDepth(z,a));
    }
    const bevel=key==='washer'?.5:.18;
    return r-Math.max(0,bevel-Math.min(z,h-z));
  }
  function inside(z,a) {
    if(key==='nut') return hole-pitch*.52+pitch*.52*threadDepth(z,a)+Math.max(0,Math.min(1.05,pitch*.3)-Math.min(h-z,z));
    return hole+(hole?Math.max(0,(key==='washer'?.45:.12)-Math.min(z,h-z)):0);
  }
  const slices = key==='stud' || key==='nut' ? Math.ceil(h/pitch*9) : 8;
  // Include the bevel boundaries even on thin components.
  const levels = [...new Set([0,h,...Array.from({length:slices-1},(_,i)=>h*(i+1)/slices)])].sort((a,b)=>a-b);
  function row(z,radius) {
    return Array.from({length:n+1},(_,i)=>{
      const a=begin+span*i/n, length=radius(z,a);
      return [length*Math.cos(a),length*Math.sin(a),z-h/2];
    });
  }
  function strip(a,b,material) {
    for(let i=0;i<a.length-1;i++) {
      triangles.push([a[i],a[i+1],b[i],material],[a[i+1],b[i+1],b[i],material]);
    }
  }
  for(const z of levels) rows.push(row(z,outside));
  for(let i=1;i<rows.length;i++) strip(rows[i-1],rows[i],0);
  const innerRows=levels.map(z=>row(part.capped?Math.min(z,h-pitch):z,inside));
  if(hole) for(let i=1;i<innerRows.length;i++) strip(innerRows[i],innerRows[i-1],1);
  strip(rows.at(-1),part.capped ? rows.at(-1).map(()=>[0,0,h/2]) : innerRows.at(-1),2);
  if(part.capped) {
    const bottom=innerRows.at(-1);
    const center=bottom.map(()=>[0,0,h/2-pitch]);
    strip(bottom,center,1);
  }
  strip(innerRows[0],rows[0],2);
  if(cut) for(const edge of [0,n]) {
    const outerEdge=rows.map(r=>r[edge]), innerEdge=innerRows.map(r=>r[edge]);
    if(edge===0) strip(innerEdge,outerEdge,3); else strip(outerEdge,innerEdge,3);
  }
  if(part.hasHoles) {
    const radius=(part.outer+part.inner)/4,hr=part.holeDiameter/2;
    for(let j=0;j<part.count;j++) {
      const angle=TAU*j/part.count,ox=radius*Math.cos(angle),oy=radius*Math.sin(angle);
      const ring=z=>Array.from({length:33},(_,i)=>[ox+hr*Math.cos(TAU*i/32),oy+hr*Math.sin(TAU*i/32),z]);
      strip(ring(-h/2),ring(h/2),1);
    }
  }
  return triangles;
}

// Rasterize the opaque surfaces into a depth buffer. Reuse the depth and normals
// for the contour plate so that internal threads stay correctly occluded.
function renderPart(key,style) {
  const part=parts[key], cut=style==='section', wire=style==='blue', macro=style==='macro';
  const side=450, height=510;
  const canvas=document.createElement('canvas');
  canvas.width=side; canvas.height=height;
  const ctx=canvas.getContext('2d');
  const triangles=surface(part,key,cut);
  const elevation=key==='stud'?.16:(key==='nut'?.53:.66);
  const tilt=wire?elevation+.10:elevation;
  const sn=Math.sin(tilt),cs=Math.cos(tilt),az=.13;
  const ca=Math.cos(az),sa=Math.sin(az);
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  const projected=new Map();
  function project(v) {
    if(!projected.has(v)) {
      const x=v[0]*ca-v[1]*sa, y=v[0]*sa+v[1]*ca;
      const point=[x,-y*sn-v[2]*cs,-y*cs+v[2]*sn];
      xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,point[1]);ymax=Math.max(ymax,point[1]);
      projected.set(v,point);
    }
    return projected.get(v);
  }
  for(const [a,b,c] of triangles){project(a);project(b);project(c)}
  const scale=Math.min(side*(macro?.67:.78)/(xmax-xmin),height*(macro?.65:.76)/(ymax-ymin));
  const midX=(xmin+xmax)/2,midY=(ymin+ymax)/2;
  const cx=side*(macro?.44:.48),cy=height*(macro?.57:.49);
  for(const p of projected.values()){p[0]=cx+(p[0]-midX)*scale;p[1]=cy+(p[1]-midY)*scale;p[2]*=scale}
  const zbuf=new Float32Array(side*height).fill(-Infinity);
  const holes=[];
  if(part.hasHoles) for(let i=0;i<part.count;i++) {
    const a=TAU*i/part.count, radius=(part.outer+part.inner)/4;
    holes.push([radius*Math.cos(a),radius*Math.sin(a)]);
  }
  const tone=new Float32Array(zbuf.length);
  const material=new Uint8Array(zbuf.length);
  const normal=new Float32Array(zbuf.length);
  for(const [va,vb,vc,mat] of triangles) {
    const a=projected.get(va),b=projected.get(vb),c=projected.get(vc);
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const area=ux*vy-uy*vx;
    if(Math.abs(area)<.00001) continue;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=area;
    const length=Math.hypot(nx,ny,nz);
    const sign=nz<0?-1:1;
    nx*=sign/length;ny*=sign/length;nz*=sign/length;
    const diffuse=clamp(.48-.27*nx-.31*ny+.18*nz,0,1);
    const softbox=Math.exp(-((nx+.38)**2)/.035);
    const rim=Math.exp(-((nx-.79)**2)/.015);
    const reflected=clamp(diffuse*.67+.30*softbox+.20*rim-.08*Math.exp(-(nx*nx)/.018),0,1);
    const value=mat===1?reflected*.69:reflected;
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(side-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
      const dx=x+.5-a[0],dy=y+.5-a[1];
      const s=(dx*vy-dy*vx)/area,t=(ux*dy-uy*dx)/area;
      if(s<0||t<0||s+t>1)continue;
      const i=y*side+x,z=a[2]+s*uz+t*vz;
      if(z<=zbuf[i])continue;
      if(holes.length && mat!==1) {
        const px=va[0]+s*(vb[0]-va[0])+t*(vc[0]-va[0]);
        const py=va[1]+s*(vb[1]-va[1])+t*(vc[1]-va[1]);
        if(holes.some(([hx,hy])=>(px-hx)**2+(py-hy)**2<(part.holeDiameter/2)**2))continue;
      }
      zbuf[i]=z;material[i]=mat;tone[i]=value;normal[i]=nx*.61+ny*.73+nz*.24;
    }
  }
  const bitmap=ctx.createImageData(side,height), pixels=bitmap.data;
  const graphite=key==='gasket';
  for(let i=0;i<zbuf.length;i++) {
    if(zbuf[i]===-Infinity)continue;
    const x=i%side,y=Math.floor(i/side),value=tone[i],mat=material[i];
    let hash=Math.imul(i+3107,0x45d9f3b);
    hash=Math.imul(hash^(hash>>>16),0x45d9f3b);
    const grain=((hash>>>22)/1024-.5)*(graphite?17:3);
    const u=(x-cx)/((xmax-xmin)*scale), v=(y-cy)/((ymax-ymin)*scale);
    let rgb;
    if(wire) {
      const outline=[i-1,i+1,i-side,i+side].some(j=>!Number.isFinite(zbuf[j])||Math.abs(zbuf[i]-zbuf[j])>6||Math.abs(normal[i]-normal[j])>.24);
      rgb=outline?[188,236,244]:[20+24*value,62+42*value,81+46*value];
    } else if(mat===3) {
      const hatch=(x+y)%13<2?-.19:0;
      rgb=[172+62*(value+hatch),90+78*(value+hatch),47+80*(value+hatch)];
    } else if(graphite) {
      const light=36+value*75+grain-21*u-17*v+4*Math.sin((x*.53+y)*1.2);
      rgb=[light,light+5,light+7];
    } else {
      const band=u*.91+v*.43;
      const sweep=47*Math.exp(-((band+.24)**2)/.016)-29*Math.exp(-((band-.15)**2)/.045);
      const radial=Math.hypot(x-cx,(y-cy)/sn);
      const brushing=mat===2?2.6*Math.sin(radial*1.75):1.3*Math.sin(y*2.1);
      const light=31+219*value+grain+sweep+brushing-15*v;
      rgb=[light+1+6*Math.max(0,-u),light+5,light+9+6*Math.max(0,u)];
    }
    const j=4*i;pixels[j]=rgb[0];pixels[j+1]=rgb[1];pixels[j+2]=rgb[2];pixels[j+3]=255;
  }
  const model=document.createElement('canvas');model.width=side;model.height=height;
  model.getContext('2d').putImageData(bitmap,0,0);
  const base=cy+(ymax-ymin)*scale/2, radius=(xmax-xmin)*scale/2;
  if(!wire) {
    ctx.save();ctx.translate(cx,base+4);ctx.scale(radius*.95,Math.max(6,radius*.085));
    const shadow=ctx.createRadialGradient(0,0,0,0,0,1);
    shadow.addColorStop(0,'#25333154');shadow.addColorStop(1,'#25333100');ctx.fillStyle=shadow;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  ctx.drawImage(model,0,0);
  if(macro) {
    const sx=cx+radius*(key==='stud'?.68:key==='nut'?.17:.24);
    const sy=cy+(key==='stud'?-.31*(ymax-ymin)*scale:key==='nut'?-.25*(ymax-ymin)*scale:
      key==='gasket'?radius*sn*Math.sqrt(1-.24**2):radius*sn*Math.sqrt((part.inner/part.outer)**2-.24**2)-part.h*cs*scale/2);
    const mx=side-80,my=89,mr=60;
    ctx.strokeStyle='#23625d';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(mx-34,my+43);ctx.stroke();
    ctx.beginPath();ctx.arc(sx,sy,11,0,TAU);ctx.stroke();
    ctx.save();ctx.beginPath();ctx.arc(mx,my,mr,0,TAU);ctx.clip();ctx.fillStyle='#f6f8f3';ctx.fillRect(mx-mr,my-mr,2*mr,2*mr);
    ctx.drawImage(model,sx-25,sy-25,50,50,mx-mr,my-mr,2*mr,2*mr);ctx.restore();
    ctx.beginPath();ctx.arc(mx,my,mr,0,TAU);ctx.stroke();
    ctx.fillStyle='#254c48';ctx.font='18px "Segoe UI",sans-serif';ctx.textAlign='right';ctx.fillText(part.detail,side-16,23);
  }
  // The horizontal axis on screen follows the diameter through the centre.
  // At its right end, the two face planes project to the same x coordinate.
  const axisX=cx-midX*scale, topY=cy+(-part.h*cs/2-midY)*scale;
  const bottomY=topY+part.h*cs*scale;
  const overlay=dimensionOverlay(key,{axisX,topY,bottomY,scale,sn,cs,base,macro});
  const plate=document.createElement('div');
  plate.className='plate';
  plate.setAttribute('role','img');
  plate.setAttribute('aria-label',part.name+' · '+styles.find(s=>s.id===style).name+' · '+part.spec+' мм');
  plate.append(canvas,overlay);
  return plate;
}

function dimensionOverlay(key,{axisX,topY,bottomY,scale,sn,cs,base,macro}) {
  const p=parts[key],r=p.outer*scale/2,bore=p.inner*scale/2;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 450 510');
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('dimensions');
  const lines=[],labels=[];
  function path(d,cls='') { lines.push(`<path class="${cls}" d="${d}"/>`) }
  function text(x,y,value,anchor='middle',rotation=0) {
    labels.push(`<text transform="translate(${x} ${y}) rotate(${rotation})" text-anchor="${anchor}">${value}</text>`);
  }
  function leader(x,y,labelX,labelY,value) {
    path(`M${x} ${y} L${labelX+38} ${labelY+8} H${labelX}`);
    lines.push(`<circle cx="${x}" cy="${y}" r="2.7"/>`);
    text(labelX,labelY,value,'start');
  }
  function diameter(radius,edgeY,dimensionY) {
    const left=axisX-radius,right=axisX+radius;
    path(`M${left} ${edgeY+3} V${dimensionY+7} M${right} ${edgeY+3} V${dimensionY+7}`,'extension');
    path(`M${left} ${dimensionY} H${right}`);
    path(`M${left} ${dimensionY} l8 -3 v6 Z M${right} ${dimensionY} l-8 -3 v6 Z`,'tips');
    text(axisX,dimensionY-9,'Ø '+number(p.outer));
  }
  if(key==='stud') {
    const threadY=topY+p.h*.16*cs*scale;
    leader(axisX-r+2,threadY,20,macro?85:42,'М'+d+' × '+number(pitch));
    diameter(r,bottomY,Math.min(490,base+42));
  } else {
    const ring=key!=='nut';
    // The rear-left quadrant is visible in both the full and cutaway models.
    leader(axisX-bore*.72,topY-bore*.694*sn,23,macro?114:57,ring?'Ø '+number(p.inner):'М'+d);
    const edgeX=axisX+r*(ring?1:.84),dimX=axisX+r+13;
    path(`M${edgeX+2} ${topY} H${dimX+6} M${edgeX+2} ${bottomY} H${dimX+6}`,'extension');
    if(ring) {
      path(`M${dimX} ${topY-18} V${bottomY+19}`);
      path(`M${dimX} ${topY} l-3 -8 h6 Z M${dimX} ${bottomY} l-3 8 h6 Z`,'tips');
      const labelY=Math.max(bottomY+39,base-4);
      path(`M${dimX} ${bottomY+15} V${labelY-7} l-8 8 h-39`);
      text(dimX-10,labelY-5,'s = '+number(p.h),'end');
      diameter(r,topY,Math.min(484,base+60));
    } else {
      path(`M${dimX} ${topY} V${bottomY}`);
      path(`M${dimX} ${topY} l-3 8 h6 Z M${dimX} ${bottomY} l-3 -8 h6 Z`,'tips');
      text(dimX+22,(topY+bottomY)/2,'m = '+number(p.h),'middle',-90);
    }
  }
  svg.innerHTML=lines.join('')+labels.join('');
  return svg;
}

function drawing(key) {
  const p=parts[key], ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 300 338');svg.setAttribute('role','img');svg.setAttribute('aria-label','Креслення · '+p.name);
  const stroke='#283e42', accent='#147165';
  const line=(x1,y1,x2,y2,color=stroke,dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-dasharray="${dash}"/>`;
  const label=(x,y,text)=>`<text x="${x}" y="${y}" fill="${accent}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600">${text}</text>`;
  function horizontal(x1,x2,y,markY,text) {
    return line(x1,markY,x1,y+5,accent)+line(x2,markY,x2,y+5,accent)+line(x1,y,x2,y,accent)
      +`<path d="M${x1} ${y} l7 -2 v4 z M${x2} ${y} l-7 -2 v4 z" fill="${accent}"/>`+label((x1+x2)/2,y-7,text);
  }
  const axis=(x1,y1,x2,y2)=>line(x1,y1,x2,y2,'#c56b1a','10 3 2 3');
  let art='';
  if(key==='stud') {
    art=p.bolt ? '<path d="M96 33 h80 l4 4 v26 h-16 v215 l-4 4 h-48 l-4 -4 V63 H92 V37 Z" fill="#e1e9e4" stroke="#283e42" stroke-width="2"/>' : '<path d="M112 33 h48 l4 4 v241 l-4 4 h-48 l-4 -4 V37 z" fill="#e1e9e4" stroke="#283e42" stroke-width="2"/>';
    for(const [start,end] of (p.bolt ? [[205,277]] : [[40,109],[205,277]])) {
      for(let y=start;y<end;y+=7) art+=line(109,y+4,163,y,'#526d68');
    }
    art+=axis(136,19,136,291)+horizontal(108,164,312,279,'Ø '+d);
    const threadY=p.bolt?223:69;
    art+=line(163,threadY,191,threadY-21,accent)+line(191,threadY-21,257,threadY-21,accent)+label(224,threadY-27,'М'+d+' × '+number(pitch));
    if(p.axialHole>0) {
      const half=28*p.axialHole/d;
      art+=line(136-half,34,136-half,282,stroke,'4 3')+line(136+half,34,136+half,282,stroke,'4 3');
      art+=line(136+half,155,195,139,accent)+label(229,135,'Ø '+number(p.axialHole));
    }
  } else {
    const cx=150,cy=123,r=87,inside=r*p.inner/p.outer;
    if(key==='nut') {
      const points=Array.from({length:6},(_,i)=>[cx+r*Math.cos(TAU*i/6),cy+r*Math.sin(TAU*i/6)].join(',')).join(' ');
      art+=`<polygon points="${points}" fill="#e1e9e4" stroke="${stroke}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r*.86}" fill="none" stroke="${stroke}"/>`;
    } else art+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${key==='gasket'?'#b7c5bf':'#e1e9e4'}" stroke="${stroke}" stroke-width="2"/>`;
    art+=`<circle cx="${cx}" cy="${cy}" r="${inside}" fill="#f4f6f0" stroke="${stroke}" stroke-width="1.8"/>`;
    if(key==='nut') art+=`<path d="M150 ${cy-inside-5} a${inside+5} ${inside+5} 0 1 1 ${-inside-5} ${inside+5}" fill="none" stroke="${stroke}"/>`;
    if(p.hasHoles) {
      const radius=(r+inside)/2,hr=r*p.holeDiameter/p.outer;
      for(let i=0;i<p.count;i++) {
        const a=TAU*i/p.count;
        art+=`<circle cx="${cx+radius*Math.cos(a)}" cy="${cy+radius*Math.sin(a)}" r="${hr}" fill="#f4f6f0" stroke="${stroke}"/>`;
      }
    }
    art+=axis(44,cy,256,cy)+axis(cx,20,cx,218);
    art+=line(cx+inside*.7,cy-inside*.7,223,46,accent)+line(223,46,282,46,accent)+label(252,39,key==='nut'?'М'+d:'Ø '+p.inner);
    if(key!=='nut')art+=horizontal(cx-r,cx+r,234,cy+7,'Ø '+p.outer);
    const x=63,y=267,h=key==='nut'?37:key==='gasket'?5:14,width=r-inside;
    for(const left of [x,cx+inside]) art+=`<rect x="${left}" y="${y}" width="${width}" height="${h}" fill="url(#hatch-${key})" stroke="${stroke}" stroke-width="1.5"/>`;
    art+=line(239,y,259,y,accent)+line(239,y+h,259,y+h,accent)+line(254,y-11,254,y+h+12,accent);
    art+=`<path d="M254 ${y} l-2 -6 h4 z M254 ${y+h} l-2 6 h4 z" fill="${accent}"/>`
      +line(254,y+h+12,249,y+h+17,accent)+line(249,y+h+17,190,y+h+17,accent)
      +label(220,y+h+13,(key==='nut'?'m':'s')+' = '+number(p.h));
  }
  svg.innerHTML=`<defs><pattern id="hatch-${key}" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-1 1l2 -2 M0 7l7 -7 M6 8l2 -2" stroke="#81918a"/></pattern></defs>`+art;
  return svg;
}


      if(style==='passport') return root.ImportedComponentStyles(style,part.bolt ? 'bolt' : key,part,pitch);
      if(part.bolt || part.axialHole>0) return drawing(key);
      if(style==='cad') return root.ImportedComponentStyles(style,key,part,pitch);
      if(part.capped && style==='paper') return root.ImportedComponentStyles('passport',key,part,pitch);
      return style==='paper'?drawing(key):renderPart(key,style);
    }
  };
})(globalThis);
