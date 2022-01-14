(() => {
  /* global Image, requestAnimationFrame, io */

  // Physics

  const maxPower = 0.075;
  const maxReverse = 0.0375;
  const powerFactor = 0.001;
  const reverseFactor = 0.0005;

  const drag = 0.95;
  const angularDrag = 0.95;
  const turnSpeed = 0.002;

  let windowWidth = window.innerWidth;
  let windowHeight = window.innerHeight;

  const canvas = document.getElementsByTagName('canvas')[0];
  const ctx = canvas.getContext('2d');

  const scene = document.getElementsByClassName('scene')[0];
  const bulletsScene = document.getElementsByClassName('bullets')[0];

  const localCar = {
    el: document.getElementsByClassName('car')[0],
    x: windowWidth / 2,
    y: windowHeight / 2,
    xVelocity: 0,
    yVelocity: 0,
    power: 0,
    reverse: 0,
    angle: 0,
    angularVelocity: 0,
    isThrottling: false,
    isReversing: false,
    isShooting: false
  };

  const cars = [localCar];
  const carsById = {};

  const bullets = [];

  let needResize;
  let resizing;

  function updateCar (car, i) {
    if (car.isHit || car.isShot) {
      if (car === localCar) {
        car.isHit = false;
        car.isShot = false;
        car.x = Math.random() * window.innerWidth;
        car.y = Math.random() * window.innerHeight;
        car.xVelocity = 0;
        car.yVelocity = 0;
        sendParams(localCar);
      }
    }

    if (car.isThrottling) {
      car.power += powerFactor * car.isThrottling;
    } else {
      car.power -= powerFactor;
    }
    if (car.isReversing) {
      car.reverse += reverseFactor;
    } else {
      car.reverse -= reverseFactor;
    }

    car.power = Math.max(0, Math.min(maxPower, car.power));
    car.reverse = Math.max(0, Math.min(maxReverse, car.reverse));

    const direction = car.power > car.reverse ? 1 : -1;

    if (car.isTurningLeft) {
      car.angularVelocity -= direction * turnSpeed * car.isTurningLeft;
    }
    if (car.isTurningRight) {
      car.angularVelocity += direction * turnSpeed * car.isTurningRight;
    }

    car.xVelocity += Math.sin(car.angle) * (car.power - car.reverse);
    car.yVelocity += Math.cos(car.angle) * (car.power - car.reverse);

    car.x += car.xVelocity;
    car.y -= car.yVelocity;
    car.xVelocity *= drag;
    car.yVelocity *= drag;
    car.angle += car.angularVelocity;
    car.angularVelocity *= angularDrag;

    if (car.isShooting) {
      if (!car.lastShootAt || car.lastShootAt < Date.now() - 60) {
        car.lastShootAt = Date.now();
        const { x, y, angle, xVelocity, yVelocity } = car;
        bullets.push({
          x: x + Math.sin(angle) * 10,
          y: y - Math.cos(angle) * 10,
          angle,
          xVelocity: xVelocity + Math.sin(angle) * 1.25,
          yVelocity: yVelocity + Math.cos(angle) * 1.25,
          shootAt: Date.now()
        });
      }
    }
  }

  function update () {
    cars.forEach(updateCar);

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];

      bullet.x += bullet.xVelocity;
      bullet.y -= bullet.yVelocity;
    }
  }

  let lastTime;
  let acc = 0;
  const step = 1 / 120;

  setInterval(() => {
    let changed;

    const canTurn = localCar.power > 0.0025 || localCar.reverse;

    const controls = window.getControls();

    const throttle = Math.round(controls.up * 10) / 10;
    const reverse = Math.round(controls.down * 10) / 10;
    const isShooting = controls.shoot;

    if (isShooting !== localCar.isShooting) {
      changed = true;
      localCar.isShooting = isShooting;
    }

    if (localCar.isThrottling !== throttle || localCar.isReversing !== reverse) {
      changed = true;
      localCar.isThrottling = throttle;
      localCar.isReversing = reverse;
    }
    const turnLeft = canTurn && Math.round(controls.left * 10) / 10;
    const turnRight = canTurn && Math.round(controls.right * 10) / 10;

    if (localCar.isTurningLeft !== turnLeft) {
      changed = true;
      localCar.isTurningLeft = turnLeft;
    }
    if (localCar.isTurningRight !== turnRight) {
      changed = true;
      localCar.isTurningRight = turnRight;
    }

    if (localCar.x > windowWidth) {
      localCar.x -= windowWidth;
      changed = true;
    } else if (localCar.x < 0) {
      localCar.x += windowWidth;
      changed = true;
    }

    if (localCar.y > windowHeight) {
      localCar.y -= windowHeight;
      changed = true;
    } else if (localCar.y < 0) {
      localCar.y += windowHeight;
      changed = true;
    }

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];

      if (localCar === car) {
        continue;
      }

      if (car.isShot) {
        continue;
      }

      if (circlesHit({ x: car.x, y: car.y, r: 7.5 }, { x: localCar.x, y: localCar.y, r: 7.5 })) {
        localCar.isHit = true;
        changed = true;
      }
    }

    for (let j = 0; j < cars.length; j++) {
      const car = cars[j];

      for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];

        if (bullet && circlesHit({ x: car.x, y: car.y, r: 7.5 }, { x: bullet.x, y: bullet.y, r: 2 })) {
          if (car !== localCar) {
            car.isShot = true;
            changed = true;
            continue;
          }
          car.x = Math.random() * window.innerWidth;
          car.y = Math.random() * window.innerHeight;
          car.xVelocity = 0;
          car.yVelocity = 0;
          car.isHit = false;
          car.isShot = false;
          changed = true;
        }
      }
    }

    const ms = Date.now();
    if (lastTime) {
      acc += (ms - lastTime) / 1000;

      while (acc > step) {
        update();

        acc -= step;
      }
    }

    lastTime = ms;

    if (changed) {
      sendParams(localCar);
    }
  }, 1000 / 120);

  function renderCar (car) {
    const { x, y, angle, power, reverse, angularVelocity } = car;

    car.el.style.transform = `translate(${x}px, ${y}px) rotate(${angle * 180 / Math.PI}deg)`;

    if (car.isShot) {
      car.el.classList.add('shot');
    } else {
      car.el.classList.remove('shot');
    }

    if ((power > 0.0025) || reverse) {
      if (((maxReverse === reverse) || (maxPower === power)) && Math.abs(angularVelocity) < 0.002) {
        return;
      }
      ctx.fillRect(
        x - Math.cos(angle + 3 * Math.PI / 2) * 3 + Math.cos(angle + 2 * Math.PI / 2) * 3,
        y - Math.sin(angle + 3 * Math.PI / 2) * 3 + Math.sin(angle + 2 * Math.PI / 2) * 3,
        1,
        1
      );
      ctx.fillRect(
        x - Math.cos(angle + 3 * Math.PI / 2) * 3 + Math.cos(angle + 4 * Math.PI / 2) * 3,
        y - Math.sin(angle + 3 * Math.PI / 2) * 3 + Math.sin(angle + 4 * Math.PI / 2) * 3,
        1,
        1
      );
    }
  }

  function render (ms) {
    requestAnimationFrame(render);

    if (needResize || resizing) {
      needResize = false;

      if (!resizing) {
        resizing = true;

        const prevImage = new Image();
        prevImage.src = canvas.toDataURL();

        prevImage.onload = () => {
          resizing = false;

          canvas.width = windowWidth;
          canvas.height = windowHeight;

          ctx.fillStyle = 'rgba(63, 63, 63, 0.25)';

          ctx.drawImage(prevImage, 0, 0);
        };
      }
    }

    cars.forEach(renderCar);

    const now = Date.now();

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      const { x, y, shootAt } = bullet;

      if (!bullet.el) {
        const el = bullet.el = document.createElement('div');
        el.classList.add('bullet');
        bulletsScene.appendChild(el);
      }
      bullet.el.style.transform = `translate(${x}px, ${y}px)`;

      if (shootAt < now - 600) {
        if (bullet.el) {
          bulletsScene.removeChild(bullet.el);
          bullets.splice(i--, 1);
        }
      }
    }
  }

  requestAnimationFrame(render);

  function resize () {
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    needResize = true;
  }

  resize();

  window.addEventListener('resize', resize);

  const socket = io('https://car.pakastin.fi', {
    withCredentials: true
  });

  socket.on('connect', () => {
    sendParams(localCar);
  });

  socket.on('join', () => {
    sendParams(localCar);
  });

  socket.on('params', ({ id, params }) => {
    let car = carsById[id];

    if (!car) {
      const el = document.createElement('div');
      el.classList.add('car');
      scene.insertBefore(el, localCar.el);
      car = {
        el
      };
      carsById[id] = car;
      cars.push(car);
    }

    for (const key in params) {
      if (key !== 'el') {
        car[key] = params[key];
      }
    }
  });

  socket.on('leave', (id) => {
    const car = carsById[id];

    if (!car) {
      return console.error('Car not found');
    }

    for (let i = 0; i < cars.length; i++) {
      if (cars[i] === car) {
        cars.splice(i, 1);
        break;
      }
    }

    if (car.el.parentNode) {
      car.el.parentNode.removeChild(car.el);
    }
    delete carsById[id];
  });

  function sendParams (car) {
    const {
      x,
      y,
      xVelocity,
      yVelocity,
      power,
      reverse,
      angle,
      angularVelocity,
      isThrottling,
      isReversing,
      isShooting,
      isTurningLeft,
      isTurningRight
    } = car;

    socket.emit('params', {
      x,
      y,
      xVelocity,
      yVelocity,
      power,
      reverse,
      angle,
      angularVelocity,
      isThrottling,
      isReversing,
      isShooting,
      isTurningLeft,
      isTurningRight
    });
  }

  const disconnect = document.getElementsByTagName('button')[0];

  disconnect.onclick = () => {
    socket.disconnect();

    while (cars.length > 1) {
      const car = cars.pop();

      car.el.parentNode.removeChild(car.el);
    }

    disconnect.parentNode.removeChild(disconnect);
  };

  const clearScreen = document.getElementsByTagName('button')[1];

  clearScreen.onclick = () => {
    ctx.clearRect(0, 0, windowWidth, windowHeight);
  };

  setInterval(() => {
    ctx.fillStyle = 'rgba(255, 255, 255, .05)';
    ctx.fillRect(0, 0, windowWidth, windowHeight);
    ctx.fillStyle = 'rgba(63, 63, 63, 0.25)';
  }, 30000);

  function circlesHit ({ x: x1, y: y1, r: r1 }, { x: x2, y: y2, r: r2 }) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) < (r1 + r2);
  }
})();
