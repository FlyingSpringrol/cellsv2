//Global variables

function render_cells(cells){
	for (var i = 0; i < cells.length; i++){
		cells[i].render();
	}
}

function update_cells(cells){
	for (var i = 0; i < cells.length; i++){
		cells[i].update_states();
	}

	for (var i = 0; i < cells.length; i++){
		cells[i].update_position();
	}
}


function gen_uid(){
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


function rand_neg(){
	if (Math.random() > .5){
		return 1.0;
	}
	else{
		return -1.0;
	}
}

class GlobalStateContainer{
	constructor(context, canvas, grid_width, cells, sp_hash, max_cells, color, max_size){
		this.context = context;
		this.screen_width = canvas.width;
		this.canvas = canvas;
		this.grid_width = grid_width;
		this.cells = cells;
		this.sp_hash = sp_hash;
		this.max_cells = max_cells;
		this.centroid_x = 0;
		this.centroid_y = 0;
		this.color = color;
		this.max_size = max_size;
	}
	init(){
		var direction3 = 0;
		this.cells.push(new NeuronCell(state, 3, this.canvas.width / 4, this.canvas.height/4, direction3, this.max_size));
	}
	create_cell(x,y){
		this.cells.push(new Cell(state, 3, x, y, 0, this.max_size));

	}
	get_hash(x, y){
		var num_grid_cells = parseFloat(this.screen_width) / parseFloat(this.grid_width) ;//should be a float
		var hash = parseInt(
			(Math.floor(x / this.grid_width)) + 
			(Math.floor(y / this.grid_width) * num_grid_cells)
		);
		return hash;
	}	
	update(){
		this.update_spatial_hash();
		this.debug_spatial_hash();
	}
	update_spatial_hash(){
		this.sp_hash.clear(); //clear hash
		//make sure it's a map!!!!
		for (var i = 0; i < this.cells.length; i++){
			var cell = this.cells[i];
			var h = this.get_hash(cell.x, cell.y);
			if (this.sp_hash.has(h)){
				//if not empty
				this.sp_hash.get(h).push(cell);
			}
			else{
				this.sp_hash.set(h, []);
				this.sp_hash.get(h).push(cell);
			}
		}
	}
	debug_spatial_hash(){
		var num_grid_cells = this.screen_width / this.grid_width;
		//vertical strokes
		for (var i = 0; i < num_grid_cells; i++){
			this.context.beginPath();
			this.context.moveTo(i * this.grid_width, 0);
			this.context.lineTo(i * this.grid_width, this.canvas.height);
			this.context.stroke();
			this.context.closePath();
		}
		for (var j = 0; j < num_grid_cells; j++){
			this.context.beginPath();
			this.context.moveTo(0, j * this.grid_width);
			this.context.lineTo(this.canvas.width, j * this.grid_width);
			this.context.stroke();
			this.context.closePath();
		}
	}
}



class Cell{
	constructor(state, size, x, y, direction, max_size){
		this.uid = gen_uid();
		this.size = size; //size is radius btw
		this.age = 0;
		this.cells = cells; //array of all the things in the world to update positions.
		this.state = state; //encapsulation over global state
		this.context = state.context;
		this.cells = state.cells;
		//growth direction
		this.direction = direction;
		//age state
		this.age = 0;
		//positional state
		this.x = x; //should refer to center
		this.y = y;
		this.max_size = max_size;
		//messaging state
		this.messaging = 0;
		this.cooldown = false;
		this.cooled = true;
		this.coolup = false;
		this.activated = false;

		//branching chance
		this.branching_chance = .9;
		this.branching_dev = Math.PI/4;
	}
	update_states(){
		//update size
		//randomly divide
		this.grow();
		this.update_message();
	}
	grow(){
		this.age += 1;
		if (this.size < this.max_size){
			this.size += this.max_size / 100;
		}
	}
	update_message(){
		if (!this.activated){
			//not activated
			return;
		}
		var time = 5;
		if (this.messaging == 0 && this.cooled){
			this.cooled = false;
			this.messaging = 1;
		}
		else if (this.messaging < time && !this.cooldown && !this.cooled){
			//ten iterations?
			this.messaging += 1;
		}
		//other case
		else if (this.messaging >= time && !this.cooldown && !this.cooled){
			this.cooldown = true;
			this.signal_neighbors();
		}
		else if (this.messaging >= -time && this.cooldown && !this.cooled){
			this.messaging -= .5;
		}
		else if (this.messaging <= -time && this.cooldown && !this.cooled){
			this.messaging = 0;
			this.cooled = true;
			this.cooldown = false;
			this.activated = false;
		}
	}
	die(){
		if (this.age > 1000){
			var index = this.cells.indexOf(this);

			if (index > -1) {
			  this.cells.splice(index, 1);
			}
			delete this;
		}
	}
	update_position(){
		//directly updates the position
		var hash = this.state.get_hash(this.x, this.y);
		var nbrs = this.state.sp_hash.get(hash);
		if (nbrs == undefined){
			return;
		}
		for (var i = 0; i < nbrs.length; i++){
			if (this.cells[i].uid == this.uid){
				continue;
			}
			var nbr = nbrs[i];
			//check if intersect, push cell out of way if intersecting.
			var dist = Math.sqrt( Math.pow((nbr.x-this.x), 2) + Math.pow((nbr.y-this.y),2));
			if (dist <= this.size + nbr.size){
				if (dist === 0.0){
					//if same cell?
					continue;
				}
				var to_move = (dist - this.size - nbr.size);
				//only move this one, the other will update as well.
				this.x += (to_move * (nbr.x - this.x) /dist)/2;
				this.y += (to_move * (nbr.y - this.y)/ dist)/2;
			}
			else{
				//attractive forces
				/*
				if (dist === 0.0){
					//if same cell?
					continue;
				}
				var to_move = (dist - this.size - nbr.size);
				//only move this one, the other will update as well.
				var x_move = (to_move * (nbr.x - this.x) / (dist*dist*dist)); //normalized dist vector
				var y_move = (to_move * (nbr.y - this.y)/ (dist*dist*dist));
				this.x += x_move; //use distance squared
				this.y += y_move;
				*/
			}
		}

	}
	render(){
		//nucleus
	   	this.context.fillStyle = this.state.color;
		this.context.beginPath();
		this.context.globalAlpha = .4;
		this.context.arc(this.x + this.size,this.y + this.size, this.size/3, 0, 2*Math.PI);
		this.context.fill();
	   	this.context.closePath();
		//outer cell
	   	if (this.messaging){
	   		this.context.fillStyle = "yellow";
			this.context.beginPath();
			this.context.globalAlpha = .4;
			this.context.arc(this.x + this.size,this.y + this.size, this.size * 1.1 ,0,2*Math.PI);
			this.context.fill();
		   	this.context.closePath();
	   	}
	   	else{
	   		this.context.beginPath();
			this.context.globalAlpha = .4;
			this.context.arc(this.x + this.size,this.y + this.size, this.size, 0, 2*Math.PI);
			this.context.fill();
	   		this.context.closePath();
	   	}
	}
	signal_neighbors(){
		//calculate in a radius
		//directly updates the position
		var search_radius = 60;
		var hash = this.state.get_hash(this.x, this.y);
		var nbrs = this.state.sp_hash.get(hash);
		if (nbrs == undefined){
			return;
		}
		for (var i = 0; i < nbrs.length; i++){
			if (this.cells[i].uid == this.uid){
				continue;
			}
			var nbr = nbrs[i];
			//check if intersect, push cell out of way if intersecting.
			var dist = Math.sqrt( Math.pow((nbr.x-this.x), 2) + Math.pow((nbr.y-this.y),2));
			if (dist <= search_radius + nbr.size){
				//inside radius
				nbr.activated = true;
			}
		}
	}
}
class NeuronCell extends Cell{
	constructor(state,size, x, y, direction, max_size){
		super(state,size, x, y, direction, max_size);
	}
	render(){
		//nucleus
	   	this.context.fillStyle = this.state.color;
		this.context.beginPath();
		this.context.globalAlpha = .4;
		this.context.arc(this.x + this.size, this.y + this.size, this.size/3,0,2*Math.PI);
		this.context.fill();
	   	this.context.closePath();
		//outer cell
		if (this.cooldown != 0){
			this.context.fillStyle = "yellow";
		}
		else{
			this.context.fillStyle = "red";
		}
		this.context.beginPath();
		this.context.globalAlpha = .4;
		this.context.arc(this.x + this.size, this.y + this.size, this.size,0,2*Math.PI);
		this.context.fill();
	   	this.context.closePath();
	}
	update_message(){
		var time = 50;
		if (Math.random() > .99 && this.messaging == 0 && this.cooled){
			this.cooled = false;
			this.messaging = 1;
		}
		else if (this.messaging < time && !this.cooldown && !this.cooled){
			//ten iterations?
			this.messaging += 1;
		}
		//other case
		else if (this.messaging >= time && !this.cooled){
			this.cooldown = true;
			this.signal_neighbors();
			this.messaging -= 1;
		}
		else if (this.messaging > 0 && this.cooldown){
			this.messaging -= 1;
		}
		else if (this.messaging == 0 && !this.cooled && this.cooldown){
			this.messaging = 0;
			this.cooled = true;
			this.cooldown = false;
		}
	}
	grow(){
		this.age += 1;
		if (this.size < this.max_size){
			this.size += this.max_size / 100;
		}
	}
	divide(){
		return;
	}
}
