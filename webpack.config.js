const path = require('path');
webpack=require("webpack");

module.exports = env =>{
	return{
        mode:"development",
		
        devtool: 'inline-source-map',
		devServer: {
			headers: {
				"Cross-Origin-Opener-Policy":"same-origin",
				"Cross-Origin-Embedder-Policy":"require-corp"		
			},
			static:"./public/"
		  },
	
	   entry: './src/modules/dev_index.js',

  	   output: {
    		   filename: 'dist/ciview2.js',

  	   },
  	   module:{ 
			
     		rules:[
			{
				test:/\.css$/,
				use:[
					"style-loader",
					"css-loader"
				]
				
			},
			{
				test: /\.(png|svg|jpg|gif|eot|ttf|woff|woff2)$/,
				type: 'asset/resource'
			
			}		
		]
  	}
}
};


