import WGLChart from "./WGLChart.js";
import {WGL2DI} from "../webgl/WGL2DI.js";
import {curveBasis,line} from "d3-shape";
import {easeLinear} from "d3-ease";
import {select} from "d3-selection";
import BaseChart from "./BaseChart";


class ViolinPlot extends WGLChart{
    constructor(dataStore,div,config){
		const x_name= dataStore.getColumnName(config.param[0]);
		const y_name = dataStore.getColumnName(config.param[1]);
		if (!config.axis){

            config.axis={
                x:{size:30,label:x_name,textsize:13},
                y:{size:45,label:y_name,textsize:13}
            }
        }
		if (!config.title){
			config.title= `${x_name} x ${y_name}`;	
		}
    	super(dataStore,div,config,{x:{type:"band"},y:{}});
        this.config.type="violin_plot";

        const c = this.config;
		c.brush = c.brush || "poly";

        const appConf= {brush:c.brush};

        this.app = new WGL2DI(this.graphDiv,appConf);
        const colorFunc = this.afterAppCreation();
        const len = this.dataStore.size;
        this.xPosBuff= new SharedArrayBuffer(len*4);
        this.xPos = new Float32Array(this.xPosBuff);

        this.values = this.dataStore.getColumnValues(c.param[0]);
        const cats =this.dataStore.getRawColumn(c.param[0])
        //jitter x position
        for (let i=0;i<len;i++){
            this.xPos[i] = cats[i]*50+4+Math.random()*42;
        }

        //set default band width
        const mm = this.dataStore.getMinMaxForColumn(c.param[1]);
        this.defaultBandWidth= (mm[1]-mm[0])/100;
        c.band_width =c.band_width || this.defaultBandWidth;
        c.intervals = c.intervals || 20;

        this.dim= this.dataStore.getDimension("catrange_dimension")
        this.x_scale.domain(this.values);
        const cy = this.dataStore.columnIndex[c.param[1]];
        this.app.addCircles({
			x:this.xPos,
			y:cy.datatype==="int32"?new Float32Array(cy.data):cy.data,
			localFilter:this.dim.getLocalFilter(),
			globalFilter:this.dataStore.getFilter(),
			colorFunc:colorFunc
			
		});
        this.app.addHandler("brush_stopped",(range,is_poly)=>{
		    this.resetButton.style.display = "inline";
			this.app.setFilter(true);
		    if (!is_poly){
		        this._createFilter(range);
		    }
		    else{
		    	this._createPolyFilter(range);
		    }
		});

        c.radius= c.radius || 5;
		c.opacity= c.opacity || 0.8;
		
		this.app.setPointRadius(this.config.radius);
		this.app.setPointOpacity(this.config.opacity);
        this.data=[];
		this.centerGraph();
        this.onDataFiltered();
     
    }

    _createFilter(range){
		this.range=range;
        if (range==null){
            this.dim.removeFilter();
        }
        else{
        	const y_max=range.y_max;
        	const y_min=range.y_min;
        	const x_max=range.x_max;
        	const x_min=range.x_min;
			this.filter= [[x_min,x_max],[y_min,y_max]]
            this.dim("filterSquare",[this.xPos,this.config.param[1]],{range1:this.filter[0],range2:this.filter[1]},[this.xPos,1]);
            this.app.refresh();
        }
    }

    onDataFiltered(dim){
        if (this.isPinned){
            return;
        }
       
        if (dim !== this.dim){
            if (dim === "all_removed"){
                this.app.clearBrush();
                this.app.setFilter(false);
                this.resetButton.style.display="none";  
            }
            const c = this.config;
            this.ticks=this.y_scale.ticks(c.intervals);
            this.dim.getKernalDensity(data=>{
                this.data=data;
                this.drawChart();
            },c.param,
            {ticks:this.ticks,bandwidth:c.band_width,intervals:c.intervals,xPos:this.xPosBuff})
        }    
       	
	}


    drawChart(){
        const trans = select(this.contentDiv).transition()
        .duration(400).ease(easeLinear);
        const scales= [];
        const catLen= this.data.length;
        
        const cdim = this._getContentDimensions();
        
        const vWidth = cdim.width/catLen;
        const values=[];
        for (let i=0;i<this.data.length;i++){
    
            scales.push((vWidth/(2*this.data[i].max))*.9);
            values.push(this.values[this.data[i].id]);
            
        }
        this.x_scale.domain(values);
        this.centerGraph();
        const ypos= this.ticks.map(x=>this.y_scale(x));
        
        
      

        const display_data=[];
        
        for (let i=0;i<this.data.length;i++){
            
            const pos = i*vWidth+(0.5*vWidth);
            const arr=[];
            let start= true;
            for (let n =0;n<this.data[i].length;n++){
                const v= this.data[i][n];
                if (v===0 || Number.isNaN(v)){
                   if (!start){
                       if (arr[arr.length-1][2]===0){
                           continue;
                       }
                       
                        arr.push([ypos[n],pos,0])
                   }

                    continue;
                }
                if (arr.length===0){
                    if (n===0){
                        arr.push([0,pos,0]);
                        continue;
                    }
                    
                        arr.push([ypos[n-1],pos,0])
                    start=false;
                }
    
                arr.push([ypos[n],pos,scales[i]*v])
            }
            if (arr.length===0){
                arr.push([0,pos,0]);
                arr.push([0,pos,0]);
            }
         
            else {
                if (arr[arr.length-1][2]!==0){
                    arr.push([cdim.height,pos,0]);
                }
            }        
            display_data.push(arr);
            arr.id = this.data[i].id
        }
      

        const colors = this.dataStore.getColumnColors(this.config.param[0]);
        const ga =this.graph_area.selectAll(".violin-curve")
        .data(display_data,d=>`A${d.id}`);
        ga.join("path")     
        .attr("class","violin-curve")
        .transition(trans)
        .attr("fill", "none")
        //.attr("opacity",0.7)

        .attr("stroke", (d,i)=>colors[d.id])
        .attr("stroke-width", 2)
        .attr("stroke-linejoin", "round")
        .attr("d",line()
        .curve(curveBasis)
          .x((d,i) => d[1]+d[2] )
          .y((d,i) => d[0])
      );
      this.graph_area.selectAll(".violin-curve1")
      .data(display_data,d=>`B${d.id}`).join("path")     
      .attr("class","violin-curve1")
      .transition(trans)
      .attr("fill", "none")
     // .attr("opacity", 0.7)
     // .attr("stroke", "#000")
     .attr("stroke", (d,i)=>colors[d.id])
     .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("d",line()
      .curve(curveBasis)
        .x((d,i) => d[1]-d[2] )
        .y((d,i) => d[0])
    );
    //this.centerGraph();
    this.app.refresh();
   


    }

    unpinChart(){
        super.unpinChart();
        this.onDataFiltered();
    }


    onDataAdded(newSize){
        const p = this.config.param;
		const config = this.getSetupConfig();
        const newX= new Float32Array(newSize);
        newX.set(this.xPos);
        this.values = this.dataStore.getColumnValues(p[0]);
        const cats =this.dataStore.getRawColumn(p[0])
        //jitter x position
        for (let i=this.xPos.length;i<newSize;i++){
            newX[i] = cats[i]*50+4+Math.random()*42;
        }
        this.xPos=newX;
        config.x = newX;
        config.y=this.dataStore.getRawColumn(p[1]);
        //update the filter with the extra data 
        if (this.dim.filterColumns){
            this.dimFilterColumns[0]=newX;
        }
      
        this.app.updateSize(newSize,config);
        super.onDataAdded(newSize);
    }


    setSize(x,y){
        super.setSize(x,y);
        this.drawChart();
    }

    centerGraph(){
        const mm = this.dataStore.getMinMaxForColumn(this.config.param[1])
        const max_x=this.data.length*50;
    	const max_y=mm[1]
    	const min_x=0
    	const min_y=mm[0];
    

        const y_margin=((max_y-min_y)/20);
        const x_range = (max_x-min_x);
        const y_range= (max_y-min_y)+2*y_margin;

        const dim = this._getContentDimensions();

        this.app.x_scale =(dim.width)/x_range;
        this.app.y_scale =(dim.height)/y_range;
        this.app.offset[0]=-(min_x);
        this.app.offset[1]=(max_y+y_margin);
		this._updateScale(this.app.getRange());
		this.updateAxis();
    }

    _updateScale(range){	
        //this.x_scale.domain([range.x_range[0],range.x_range[1]]);     
        this.y_scale.domain([-range.y_range[0],-range.y_range[1]]);   
    }


    getSettings(){
        const s = super.getSettings();
        const c = this.config;
        const mm = this.dataStore.getMinMaxForColumn(c.param[1]);

        s.splice(1,0,
            {
            
                type:"slider",
                max:mm[1]/10,
                min:mm[0]<0?0:mm[0],
                doc:this.__doc__,
                current_value:c.band_width,
                label:"Band Width",
                func:(x)=>{
                    c.band_width=x;
                    this.onDataFiltered();
                }
            },
            {
            
                type:"slider",
                max:100,
                min:10,
                step:1,
                doc:this.__doc__,
                current_value:c.intervals,
                label:"Intervals",
                func:(x)=>{
                    c.intervals=x;
                    this.onDataFiltered();
                }
            },

            
            
            
            
            );
        return s;

    }

    _createPolyFilter(vs){
    	this.range=true;
    	for (const pt of vs){
    		pt[1]=-pt[1];
    		if (this.config.axis.x_log_scale){
    			pt[0]=this._getInverseLogValue(pt[0]);
    		}
    		if (this.config.axis.y_log_scale){
    			pt[1]=this._getInverseLogValue(pt[1]);
    		}
    	}
		this.filter= vs;
		this.dim.filter("filterPoly",[this.xPos,this.config.param[1]],vs);
        this.app.refresh();
    }

}

BaseChart.types["violin_plot"]={
    "class":ViolinPlot,
    name:"Violin Plot",
    params:[
        {
            type:"text",
            name:"Category (X axis)"
        },
        {
            type:"number",
            name:"Value (Y axis)"
        }
    ]

}

export default ViolinPlot;