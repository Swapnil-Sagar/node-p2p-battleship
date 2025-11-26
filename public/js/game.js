var GameStatus = {
  inProgress: 1,
  gameOver: 2
}

var Game = (function () {
  var canvas = [],
    context = [],
    grid = [],
    gridHeight = 381,
    gridWidth = 381,
    gridBorder = 1,
    gridRows = 10,
    gridCols = 10,
    markPadding = 10,
    shipPadding = 3,
    squareHeight = (gridHeight - gridBorder * gridRows - gridBorder) / gridRows,
    squareWidth = (gridWidth - gridBorder * gridCols - gridBorder) / gridCols,
    turn = false,
    gameStatus,
    squareHover = { x: -1, y: -1 }

  canvas[0] = document.getElementById('canvas-grid1') // This player
  canvas[1] = document.getElementById('canvas-grid2') // Opponent
  context[0] = canvas[0].getContext('2d')
  context[1] = canvas[1].getContext('2d')

  /**
   * Highlight opponent square on hover
   */
  canvas[1].addEventListener('mousemove', function (e) {
    var pos = getCanvasCoordinates(e, canvas[1])
    squareHover = getSquare(pos.x, pos.y)
    drawGrid(1)
  })

  /**
   * Mouse moved out of opponent grid. Unhighlight.
   */
  canvas[1].addEventListener('mouseout', function (e) {
    squareHover = { x: -1, y: -1 }
    drawGrid(1)
  })

  /**
   * Fire shot on mouse click event (if it's user's turn).
   */
  canvas[1].addEventListener('click', function (e) {
    if (turn) {
      var pos = getCanvasCoordinates(e, canvas[1])
      var square = getSquare(pos.x, pos.y)
      sendShot(square)
    }
  })

  /**
   * Get square from mouse coordinates
   * @param {type} x Mouse x
   * @param {type} y Mouse y
   * @returns {Object}
   */
  function getSquare(x, y) {
    return {
      x: Math.floor(x / (gridWidth / gridCols)),
      y: Math.floor(y / (gridHeight / gridRows))
    }
  }

  /**
   * Get mouse position on canvas relative to canvas top,left corner
   * @param {type} event
   * @param {type} canvas
   * @returns {Object} Position
   */
  function getCanvasCoordinates(event, canvas) {
    rect = canvas.getBoundingClientRect()
    return {
      x: Math.round(((event.clientX - rect.left) / (rect.right - rect.left)) * canvas.width),
      y: Math.round(((event.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height)
    }
  }

  /**
   * Init new game
   */
  function initGame() {
    var i

    gameStatus = GameStatus.inProgress

    // Create empty grids for player and opponent
    grid[0] = { shots: Array(gridRows * gridCols), ships: [] }
    grid[1] = { shots: Array(gridRows * gridCols), ships: [] }

    for (i = 0; i < gridRows * gridCols; i++) {
      grid[0].shots[i] = 0
      grid[1].shots[i] = 0
    }

    // Reset turn status classes
    $('#turn-status')
      .removeClass('alert-your-turn')
      .removeClass('alert-opponent-turn')
      .removeClass('alert-winner')
      .removeClass('alert-loser')

    drawGrid(0)
    drawGrid(1)
  }

  /**
   * Update player's or opponent's grid.
   * @param {type} player
   * @param {type} gridState
   * @returns {undefined}
   */
  function updateGrid(player, gridState) {
    grid[player] = gridState
    drawGrid(player)
  }

  /**
   * Set if it's this client's turn
   * @param {type} turnState
   * @returns {undefined}
   */
  function setTurn(turnState) {
    if (gameStatus !== GameStatus.gameOver) {
      turn = turnState

      if (turn) {
        $('#turn-status')
          .removeClass('alert-opponent-turn')
          .addClass('alert-your-turn')
          .html("It's your turn!")
      } else {
        $('#turn-status')
          .removeClass('alert-your-turn')
          .addClass('alert-opponent-turn')
          .html('Waiting for opponent.')
      }
    }
  }

  /**
   * Set game over and show winning/losing message
   * @param {Boolean} isWinner
   */
  function setGameOver(isWinner) {
    gameStatus = GameStatus.gameOver
    turn = false

    if (isWinner) {
      $('#turn-status')
        .removeClass('alert-opponent-turn')
        .removeClass('alert-your-turn')
        .addClass('alert-winner')
        .html('You won! <a href="#" class="btn-leave-game">Play again</a>.')
    } else {
      $('#turn-status')
        .removeClass('alert-opponent-turn')
        .removeClass('alert-your-turn')
        .addClass('alert-loser')
        .html('You lost. <a href="#" class="btn-leave-game">Play again</a>.')
    }
    $('.btn-leave-game').click(sendLeaveRequest)
  }

  /*
   * Draw a grid with squares, ships and shot marks
   */
  function drawGrid(gridIndex) {
    drawSquares(gridIndex)
    drawShips(gridIndex)
    drawMarks(gridIndex)
  }

  /**
   * Draw grid squares/background
   * @param {Number} gridIndex
   */
  function drawSquares(gridIndex) {
    var i, j, squareX, squareY

    context[gridIndex].fillStyle = '#222222'
    context[gridIndex].fillRect(0, 0, gridWidth, gridHeight)

    for (i = 0; i < gridRows; i++) {
      for (j = 0; j < gridCols; j++) {
        squareX = j * (squareWidth + gridBorder) + gridBorder
        squareY = i * (squareHeight + gridBorder) + gridBorder

        context[gridIndex].fillStyle = '#7799FF'

        // Highlight square if it's user's turn and user hovers over an unfired on, opponent square.
        if (
          j === squareHover.x &&
          i === squareHover.y &&
          gridIndex === 1 &&
          grid[gridIndex].shots[i * gridCols + j] === 0 &&
          turn
        ) {
          context[gridIndex].fillStyle = '#4477FF'
        }

        context[gridIndex].fillRect(squareX, squareY, squareWidth, squareHeight)
      }
    }
  }

  /**
   * Draw visible ships on grid
   * @param {Number} gridIndex
   */
  // function drawShips(gridIndex) {
  //   var ship, i, x, y, shipWidth, shipLength

  //   for (i = 0; i < grid[gridIndex].ships.length; i++) {
  //     ship = grid[gridIndex].ships[i]

  //     x = ship.x * (squareWidth + gridBorder) + gridBorder + shipPadding
  //     y = ship.y * (squareHeight + gridBorder) + gridBorder + shipPadding
  //     shipWidth = squareWidth - shipPadding * 2
  //     shipLength = squareWidth * ship.size + gridBorder * (ship.size - 1) - shipPadding * 2

  //     context[gridIndex].fillStyle = '#0077be' // Ship color (blue)
  //     context[gridIndex].strokeStyle = '#130f40' // Ship border color (darker blue)
  //     context[gridIndex].lineWidth = 2

  //     context[gridIndex].beginPath()

  //     if (ship.horizontal) {
  //       // Draw a horizontal ship with pointed ends
  //       context[gridIndex].moveTo(x, y + shipWidth / 2) // Start at the left tip
  //       context[gridIndex].lineTo(x + shipWidth / 2, y) // Top-left corner
  //       context[gridIndex].lineTo(x + shipLength - shipWidth / 2, y) // Top-right corner
  //       context[gridIndex].lineTo(x + shipLength, y + shipWidth / 2) // Right tip
  //       context[gridIndex].lineTo(x + shipLength - shipWidth / 2, y + shipWidth) // Bottom-right corner
  //       context[gridIndex].lineTo(x + shipWidth / 2, y + shipWidth) // Bottom-left corner
  //       context[gridIndex].closePath() // Back to the left tip
  //     } else {
  //       // Draw a vertical ship with pointed ends
  //       context[gridIndex].moveTo(x + shipWidth / 2, y) // Start at the top tip
  //       context[gridIndex].lineTo(x, y + shipWidth / 2) // Top-left corner
  //       context[gridIndex].lineTo(x, y + shipLength - shipWidth / 2) // Bottom-left corner
  //       context[gridIndex].lineTo(x + shipWidth / 2, y + shipLength) // Bottom tip
  //       context[gridIndex].lineTo(x + shipWidth, y + shipLength - shipWidth / 2) // Bottom-right corner
  //       context[gridIndex].lineTo(x + shipWidth, y + shipWidth / 2) // Top-right corner
  //       context[gridIndex].closePath() // Back to the top tip
  //     }

  //     context[gridIndex].fill() // Fill the ship body
  //     context[gridIndex].stroke() // Draw the ship border
  //   }
  // }

  const shipImages = {
    shortHorizontal: new Image(),
    shortVertical: new Image(),
    longHorizontal: new Image(),
    longVertical: new Image()
  }

  shipImages.shortHorizontal.src = '../assets/ship-h-sm2.png'
  shipImages.shortVertical.src = '../assets/ship-v-sm2.png'
  shipImages.longHorizontal.src = '../assets/ship-h-lg.png'
  shipImages.longVertical.src = '../assets/ship-v-lg2.png'

  Object.keys(shipImages).forEach((key) => {
    shipImages[key].onload = () => console.log(`${key} image loaded`)
    shipImages[key].onerror = () => console.error(`Failed to load ${key} image`)
  })

  function drawShips(gridIndex) {
    var ship, i, x, y, shipWidth, shipLength, imageKey

    for (i = 0; i < grid[gridIndex].ships.length; i++) {
      ship = grid[gridIndex].ships[i]

      x = ship.x * (squareWidth + gridBorder) + gridBorder + shipPadding
      y = ship.y * (squareHeight + gridBorder) + gridBorder + shipPadding
      shipWidth = squareWidth - shipPadding * 2
      shipLength = squareWidth * ship.size + gridBorder * (ship.size - 1) - shipPadding * 2

      if (ship.size <= 3) {
        imageKey = ship.horizontal ? 'shortHorizontal' : 'shortVertical'
      } else {
        imageKey = ship.horizontal ? 'longHorizontal' : 'longVertical'
      }

      if (shipImages[imageKey].complete && shipImages[imageKey].naturalWidth > 0) {
        if (ship.horizontal) {
          context[gridIndex].drawImage(shipImages[imageKey], x, y, shipLength, shipWidth)
        } else {
          context[gridIndex].drawImage(shipImages[imageKey], x, y, shipWidth, shipLength)
        }
      } else {
        console.warn(`${imageKey} not loaded, using fallback`)
        context[gridIndex].fillStyle = '#444444'
        context[gridIndex].fillRect(
          x,
          y,
          ship.horizontal ? shipLength : shipWidth,
          ship.horizontal ? shipWidth : shipLength
        )
      }
    }
  }

  /**
   * Draw shot marks on grid (black crosses for missed and red circles for hits)
   * @param {Number} gridIndex
   */
  function drawMarks(gridIndex) {
    var i, j, squareX, squareY

    for (i = 0; i < gridRows; i++) {
      for (j = 0; j < gridCols; j++) {
        squareX = j * (squareWidth + gridBorder) + gridBorder
        squareY = i * (squareHeight + gridBorder) + gridBorder

        // draw black cross if there is a missed shot on square
        if (grid[gridIndex].shots[i * gridCols + j] === 1) {
          context[gridIndex].beginPath()
          context[gridIndex].moveTo(squareX + markPadding, squareY + markPadding)
          context[gridIndex].lineTo(
            squareX + squareWidth - markPadding,
            squareY + squareHeight - markPadding
          )
          context[gridIndex].moveTo(squareX + squareWidth - markPadding, squareY + markPadding)
          context[gridIndex].lineTo(squareX + markPadding, squareY + squareHeight - markPadding)
          context[gridIndex].strokeStyle = '#000000'
          context[gridIndex].stroke()
        }
        // draw red circle if hit on square
        else if (grid[gridIndex].shots[i * gridCols + j] === 2) {
          context[gridIndex].beginPath()
          context[gridIndex].arc(
            squareX + squareWidth / 2,
            squareY + squareWidth / 2,
            squareWidth / 2 - markPadding,
            0,
            2 * Math.PI,
            false
          )
          context[gridIndex].fillStyle = '#E62E2E'
          context[gridIndex].fill()
        }
      }
    }
  }

  return {
    initGame: initGame,
    updateGrid: updateGrid,
    setTurn: setTurn,
    setGameOver: setGameOver
  }
})()
