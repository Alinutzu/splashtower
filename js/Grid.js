class Grid {
  constructor(cols = 20, rows = 12, cellSize = 40, waypoints) {
    this.cols = cols;
    this.rows = rows;
    this.cellSize = cellSize;
    this.width = cols * cellSize;
    this.height = rows * cellSize;

    this.waypoints = waypoints || [
      { x: 0, y: 2 * cellSize + cellSize / 2 },
      { x: 7 * cellSize + cellSize / 2, y: 2 * cellSize + cellSize / 2 },
      { x: 7 * cellSize + cellSize / 2, y: 5 * cellSize + cellSize / 2 },
      { x: 3 * cellSize + cellSize / 2, y: 5 * cellSize + cellSize / 2 },
      { x: 3 * cellSize + cellSize / 2, y: 8 * cellSize + cellSize / 2 },
      { x: 15 * cellSize + cellSize / 2, y: 8 * cellSize + cellSize / 2 },
      { x: 15 * cellSize + cellSize / 2, y: 10 * cellSize + cellSize / 2 },
      { x: this.width, y: 10 * cellSize + cellSize / 2 },
    ];

    this.pathCells = new Set();
    this._computePathCells();

    this.hoverCol = -1;
    this.hoverRow = -1;
  }

  _computePathCells() {
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const cA = this.pixelToCell(a.x, a.y);
      const cB = this.pixelToCell(b.x, b.y);
      if (cA.col === cB.col) {
        const minR = Math.min(cA.row, cB.row);
        const maxR = Math.max(cA.row, cB.row);
        for (let r = minR; r <= maxR; r++) {
          this.pathCells.add(`${cA.col},${r}`);
        }
      } else {
        const minC = Math.min(cA.col, cB.col);
        const maxC = Math.max(cA.col, cB.col);
        for (let c = minC; c <= maxC; c++) {
          this.pathCells.add(`${c},${cA.row}`);
        }
      }
    }
  }

  cellToPixel(col, row) {
    return {
      x: col * this.cellSize + this.cellSize / 2,
      y: row * this.cellSize + this.cellSize / 2,
    };
  }

  pixelToCell(x, y) {
    if (!isFinite(x) || !isFinite(y)) return { col: 0, row: 0 };
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return { col: Math.max(0, Math.min(this.cols - 1, col)), row: Math.max(0, Math.min(this.rows - 1, row)) };
  }

  isPathCell(col, row) {
    return this.pathCells.has(`${col},${row}`);
  }

  getCellRect(col, row) {
    return {
      x: col * this.cellSize,
      y: row * this.cellSize,
      w: this.cellSize,
      h: this.cellSize,
    };
  }

  draw(ctx) {
    ctx.save();

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.cellSize;
        const y = r * this.cellSize;
        const isPath = this.isPathCell(c, r);

        if (isPath) {
          ctx.fillStyle = '#2a2a23';
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
          ctx.fillStyle = '#3a3a30';
          ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
        } else {
          ctx.fillStyle = '#22221c';
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      }
    }

    this._drawPathArrows(ctx);

    if (this.hoverCol >= 0 && this.hoverRow >= 0) {
      const isPath = this.isPathCell(this.hoverCol, this.hoverRow);
      const x = this.hoverCol * this.cellSize;
      const y = this.hoverRow * this.cellSize;
      ctx.fillStyle = isPath ? 'rgba(255,0,170,0.15)' : 'rgba(0,240,255,0.12)';
      ctx.fillRect(x, y, this.cellSize, this.cellSize);
      ctx.strokeStyle = isPath ? '#ff00aa' : '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = isPath ? '#ff00aa' : '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawPathArrows(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.fillStyle = 'rgba(0,240,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(angle) * 6, my + Math.sin(angle) * 6);
      ctx.lineTo(mx + Math.cos(angle + 2.4) * 6, my + Math.sin(angle + 2.4) * 6);
      ctx.lineTo(mx + Math.cos(angle - 2.4) * 6, my + Math.sin(angle - 2.4) * 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  drawEntryExit(ctx) {
    ctx.save();
    const entry = this.waypoints[0];
    ctx.fillStyle = 'rgba(0,240,255,0.15)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,240,255,0.3)';
    ctx.fillText('▶ INTRARE', entry.x, entry.y - 16);

    const exit = this.waypoints[this.waypoints.length - 1];
    ctx.fillStyle = 'rgba(255,0,170,0.3)';
    ctx.fillText('IESIRE ▶', exit.x - 20, exit.y - 16);
    ctx.restore();
  }

  setHover(col, row) {
    this.hoverCol = col;
    this.hoverRow = row;
  }

  clearHover() {
    this.hoverCol = -1;
    this.hoverRow = -1;
  }
}

window.Grid = Grid;
