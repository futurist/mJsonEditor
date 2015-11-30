

/**
 * Helper functions
 */
if(!clone)
var clone = function clone(objectToBeCloned) {
  // Basis.
  if (!(objectToBeCloned instanceof Object)) {
    return objectToBeCloned;
  }

  var objectClone;

  // Filter out special objects.
  var Constructor = objectToBeCloned.constructor;
  switch (Constructor) {
    // Implement other special objects here.
    case RegExp:
      objectClone = new Constructor(objectToBeCloned);
      break;
    case Date:
      objectClone = new Constructor(objectToBeCloned.getTime());
      break;
    default:
      objectClone = new Constructor();
  }

  // Clone each property.
  for (var prop in objectToBeCloned) {
    objectClone[prop] = clone(objectToBeCloned[prop]);
  }

  return objectClone;
}

/**
 * Only add to object key,val when key is not exists
 * @param {object} obj   the obejct to check and add value to
 * @param {string} key   key to check and add
 * @param {any} value the value to add when key not exists
 */
if(!addToObject)
var addToObject = function addToObject( obj, key, value ){
	if( !(key in obj) ){
		obj[key] = value;
	}
}

/**
 * JsonEditor component
 * - Dependacy: function[ clone ]
 * @param {object} SCHEMA the json schema according to http://json-schema.org/
 * @param {object} DATA   the json data of user data
 * @param {string/number} key   key to pass to v-dom
 */
var JsonEditor = function JsonEditor( SCHEMA, DATA, key ) {
	var schemaDefaultValue = {}
	var LEVEL_MARGIN = 10;
	function schemaPathValue( path, value ){
		if(typeof path=='string') path = path.split('.');
		var val = _dotPathValue(schemaDefaultValue, path);
		if( arguments.length<2 ) return val;
		else return val===undefined?_dotPathValue(schemaDefaultValue, path, value):value
	}

	function dataPathValue( path, value ){
		if(typeof path=='string') path = path.split('.')
		if( arguments.length<2 ) {
			var val = _dotPathValue(DATA, path);
			return val===undefined? (schemaPathValue(path)||'' ) : val;
		} else {
			return _dotPathValue(DATA, path, value)
		}
	}
	function _dotPathValue( obj, path, value ){
		if(path.length<2) {
			return obj;
		}
		var data = obj;
		for(var v, i=1; v=path[i], i<path.length; i++ ){
			if(arguments.length>=3){
				if(data===undefined){
					data = clone(schemaPathValue( path.slice(0, i) ))
					obj[ path.slice(0, i).pop() ] = data;
				}
				if(i==path.length-1){
					data[v] = value;
				}
			}
			data = data&&data[v]
		}
		return data;
	}

	var JSON_SCHEMA_MAP = (function(){
	  var obj = {}
	  obj.template = function(path, obj, key){
	    function replacer(match, placeholder, offset, string) {
	      return dataPathValue( path.slice(0,-1).join('.')+'.'+placeholder );
	    }
	    dataPathValue( path.join('.'), obj[key].replace(/\{\{([^}]+)\}\}/g, replacer) )
	    return ['value', dataPathValue( path.join('.') ), 'disabled', true ]
	  }
	  obj.minLength = function(path, obj, key){ return ['pattern', '.{'+ obj[key] +',}' ] }
	  obj.minimum = 'min'
	  obj.maximum = 'max'
	  obj.description = 'placeholder'
	  // obj.default = 'defaultValue'
	  return obj
	})()

	/**
	 * build m attrs from JSON schema property
	 * [dependancy] JSON_SCHEMA_KEY_MAP object
	 *
	 * @param  {object} props   JSON schema property object, undefined value will be ''
	 * @param  {object} include  include value to overwrite specified attrs
	 * @param  {array} exclude  array that exclude in returned attrs
	 * @return {object}         m attrs object
	 */
	function buildAttrs( path, props, include, exclude ){
	  var obj = {}, include=include||{}, exclude=exclude||[]
	  Object.keys(props).forEach(function(v){
	    var map = JSON_SCHEMA_MAP[v];
	    if(typeof map=='function') {
	      for(var i=0, val=map(path, props, v); i<val.length; i+=2){
	        obj[ val[i]  ] = val[i+1]||''
	      }
	    } else {
	      obj[ map || v  ] = props[v]||''
	    }
	  })
	  for(var i in include) {
	    obj[i] = include[i]
	  }
	  exclude.forEach(function(v){
	  	delete obj[v]
	  })
	  if( !('value' in obj) ) obj['value'] = dataPathValue(path);
	  return obj;
	}


	function parseSchema(schema, key, path) {
	  path = path || [key]
	  level=path.length-1
	  switch(schema.type){
	    case 'array':
	      schemaPathValue(path, schema.default||[]);
	      return m('div.array', {'data-key': key, style:{marginLeft:level*LEVEL_MARGIN+'px'} }, [
	          m('h2', schema.title),
	          m('div.props', [
	            schema.format == 'table' ?
	            (function(){
	            	var keys = Object.keys(schema.items.properties)
		            return dataPathValue( path ).map(function (v, i) {
		              var keys = Object.keys(schema.items.properties)
		              return keys.map(function (key) {
		              	return parseSchema( schema.items.properties[key], key, path.concat(i, key) );
		              })

		            })
		        }) () : ''
	          ])
	      ])
	      break;
	    case 'object':
	      schemaPathValue(path, schema.default||{});
	      var keys = Object.keys(schema.properties)
	      return m('div.object', {'data-key': key, style:{marginLeft:level*LEVEL_MARGIN+'px'} }, [
	          m('h2', schema.title),
	          m('div.props', [
	            keys.map(function (v) { return parseSchema( schema.properties[v], v, path.concat(v) ) })
	          ])
	      ])

	      break;

	    case 'integer':
	      schemaPathValue(path, schema.default)
	      return m('div.row', {'data-key': key, style:{marginLeft:level*LEVEL_MARGIN+'px'} }, [
	          m('strong', schema.title||key ),
	          m('input', buildAttrs(path, schema, {type:'number', oninput:function(){
	            dataPathValue( path , parseInt(this.value,10) )
	          } }) ),
	        ] )

	      break;
	    case 'string':
	      schemaPathValue(path, schema.default)
	      return m('div.row', {'data-key': key, style:{marginLeft:level*LEVEL_MARGIN+'px'} }, [
	          m('strong', schema.title||key ),
	          schema.enum
	          ? m('select',
		          	buildAttrs(path, schema, {
		          		oninput:function(){
		          			dataPathValue(path, this.value)
				          } },
				    	['enum', 'type']
				    ),
		          	schema.enum.map(function(v){ return m('option', v) } )
	          	)
	          : m('input',
	          		buildAttrs(path, schema, {
	          			type: schema.format=='color'?'color':'text',
	          			oninput:function(){
	          				dataPathValue(path, this.value)
	          			} }
	          		)
	          	),

	        ] )

	      break;
	  }

	}

	this.controller = function(args){
	}
	this.view = function(ctrl){
		return parseSchema(SCHEMA, 'root')
	}
	this.getView = function() {
		return this.view( new this.controller() );
	}
}

// Usage:
// m.render( document.body, new JsonEditor( testSchema, testDATA, +new Date() ) )
