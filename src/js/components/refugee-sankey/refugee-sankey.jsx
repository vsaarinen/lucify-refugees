
var React = require('react');
var d3 = require('d3');
var _ = require('underscore');
var deepcopy = require('deepcopy');
var sprintf = require('sprintf');

d3.sankey = require('./d3-sankey.js');

var countries = require("i18n-iso-countries");
var classNames = require('classNames');


var Node = React.createClass({

	componentDidUpdate: function() {
		this.update(true);
	},

	componentDidMount: function() {
		this.update(false);
	},

	update: function(transition) {
		var item = this.props.item;
				
		var sel = d3.select(this.getDOMNode());

		if (transition) {
			sel = sel.transition();
		}

		sel.attr('transform', sprintf('translate(%.2f, %.2f)', item.x, item.y));
	
		sel.select('rect')
			//.transition()
			.attr('height', Math.round(item.dy))
			.attr('width', this.props.nodeWidth);

		sel.select('text')
			//.transition()
			.attr('y', item.dy / 2);
	},


	render: function() {
		var item = this.props.item;

		var cond = item.x < this.props.width / 2;
		var anchor = cond ? "start" : "end";
		var x = cond ? 6 + this.props.nodeWidth : -6;
		
		var classes = classNames({
			node: true,
			'node--hovered': item.name == this.props.activeCountry,
			'node--unselected': item.name !== this.props.activeCountry && this.props.activeCountry != null
		});

		return (
			<g className={classes}>
				<rect 
					onMouseOver={this.props.onMouseOver}
					onMouseOut={this.props.onMouseOut} />
				<text 
					x={x} 
					dy="0.35em"
					textAnchor={anchor}>
					{this.props.friendlyName}
				</text>
			</g>
		);
	}
	
});


var LinkPath = React.createClass({


	componentDidUpdate: function() {
		this.update(true);
	},

	componentDidMount: function() {
		this.update(false);
	},


	update: function(transition) {
		var item = this.props.item;		
		var sel = d3.select(this.getDOMNode());

		if (transition) {
			sel = sel.transition();
		}

		sel.attr('d', this.props.pathFunction(item));
	},


	render: function() {
		var item = this.props.item;
		var pathFunction = this.props.pathFunction;

		var classes = classNames({
			'link': true,
			'link--unselected': item.sourceName != this.props.activeCountry 
				&& item.targetName != this.props.activeCountry
				&& this.props.activeCountry != null,
			'link--hovered': item.sourceName == this.props.activeCountry
				|| item.targetName == this.props.activeCountry
		});

		return (
			<path 
				className={classes}
				strokeWidth={Math.max(1, item.dy)} />
		);
	}


});



var RefugeeSankey = React.createClass({


	getInitialState: function() {
		return {
			hovered: null
		}
	},


	getDefaultProps: function() {
		return {
			width: 800,
		}
	},


	componentDidMount: function() {
		this.colorScale = d3.scale.category20();
	},


	getNodes: function() {
 		return this.getOrderedNodeIds().map(function(item) {
 			return {name: item}
 		});
	},


	getOrderedNodeIds: function() {
		var items = {};
		this.getSimplifiedData().forEach(function(item) {
			items[item.oc] = true;
			items[item.ac] = true;
		})
 		return _.keys(items);
	},


	getLinks: function() {
		var nodes = this.getOrderedNodeIds();
		return this.getSimplifiedData().map(function(item) {
			return {
				source: nodes.indexOf(item.oc),
				target: nodes.indexOf(item.ac),
				sourceName: item.oc,
				targetName: item.ac,
				value: item.count
			}
		});
	},


	/*
	 * Get raw data
	 */
	getData: function() {
		return this.props.asylumData.filter(function(item) {
			return item.year == this.props.year 
				&& item.month == this.props.month + 1
				&& item.count > 0;
		}.bind(this));
	},


	// get a hash of totals for each country
	//
	getCountryTotals: function(data) {
		var sourceCounts = {};
		var targetCounts = {};

		this.getData().forEach(function(item) {
			if (!targetCounts[item.ac]) {
				targetCounts[item.ac] = 0;
			}
			targetCounts[item.ac] += item.count;
		
			if (!sourceCounts[item.oc]) {
				sourceCounts[item.oc] = 0;
			}
			sourceCounts[item.ao] += item.count;
		});

		return {
			sourceCountries: sourceCounts,
			targetCountries: targetCounts
		}
	},


	toCappedList: function(obj) {

		var sorted = _.pairs(obj).sort(function(a, b) {
			return b[1] - a[1];
		});

		return sorted.slice(0, Math.min(10, sorted.length)).map(function(item) {
			return item[0];
		});
	},


	/*
	 * Get a list of source countries that
	 * are significatn enough to be shown
	 */
	getSourceCountries: function() {
		return this.toCappedList(this.getCountryTotals().sourceCountries);
	},


	/*
	 * Get a list of target countries
     * that are significant enough to be shown
	 */
	getTargetCountries: function() {
		return this.toCappedList(this.getCountryTotals().targetCountries);
	},


	/*
	 * Get data simplified in such a way that
     * insignificant countries are mapped to "others"
     */
	getSimplifiedData: function() {
		var ret = [];

		var sourceCountries = this.getSourceCountries();
		var targetCountries = this.getTargetCountries();

		window.sourceCountries = sourceCountries;
		window.targetCountries = targetCountries;


		this.getData().forEach(function(item) {
			var sourceCountry = sourceCountries.indexOf(item.oc) !== -1 ? item.oc : "othersS";
			var targetCountry = targetCountries.indexOf(item.ac) !== -1 ? item.ac : "othersT";
			
			if (sourceCountry == "TUR") {
				sourceCountry = "TUR-S";
			}

			if (sourceCountry == "othersS" || targetCountry == "othersT") {
				var found = _.find(ret, function(val) {
					return val.oc == sourceCountry && val.ac == targetCountry;
				});
				if (found) {
					found.count += item.count;
					return;
				}
			}
			ret.push({
				oc: sourceCountry,
				ac: targetCountry,
				count: item.count
			});
		});

		window.ret = ret;

		return ret;
	},


	getWidth: function() {
		return this.props.width;
	},


	getHeight: function() {
		return this.props.width;
	},


	getCountryName: function(name) {
		switch (name) {
			case "othersS":
			case "othersT":
				return "Others";
			case "TUR":
			case "TUR-S":
				return "Turkey";
		}

		var name = this.props.mapModel.getFriendlyNameForCountry(name); 

		if (!name) {
			console.log("no name for" + name);
		}

		return name;
	},


	getActiveCountry: function() {
		return this.state.hovered;
	},


	getOnMouseOut: function(country) {
		return function() {
			if (this.state.hovered == country) {
				this.setState({hovered: null});	
			}
		}.bind(this);
	},


	getOnMouseOver: function(country) {
		return function() {
			console.log("hovering on" + country);
			this.setState({hovered: country});
		}.bind(this);
	},


	renderLinks: function(links, pathFunction) {
		return links.map(function(item) {
			return <LinkPath
					key={item.sourceName + item.targetName}
					item={item}
					pathFunction={pathFunction}
					activeCountry={this.getActiveCountry()} />
		}.bind(this));
	},


	renderNodes: function(nodes, sankey) {

		return nodes.map(function(item) {
			return (
				<Node 
					width={this.getWidth()}
					key={item.name}
				    item={item} 
					onMouseOver={this.getOnMouseOver(item.name)}
					onMouseOut={this.getOnMouseOut(item.name)}
					activeCountry={this.getActiveCountry()}
					nodeWidth={sankey.nodeWidth()}
					friendlyName={this.getCountryName(item.name)} />
			);
		}.bind(this));

	},


	render: function() {

		if (!this.props.asylumData) {
			return <svg />
		}	

		var nodes = this.getNodes();
		var links = this.getLinks();

		var sankey = d3.sankey()
			.nodeWidth(15)
			.nodePadding(10)
			.size([this.getWidth(), this.getHeight()]);

		var path = sankey.link();

		sankey
			.nodes(nodes)
			.links(links);

		sankey.layout(32);

		return (
			<svg className="refugee-sankey" 
				style={{width: this.getWidth(), height: this.getHeight()}}>
				<g>
					{this.renderNodes(nodes, sankey)}
				</g>
				<g>
					<linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="139.0532" y1="201.2666" x2="288.0332" y2="201.2666">
						<stop offset="0" style={{stopColor: '#6AB3B3'}} />
						<stop offset="1" style={{stopColor: '#81BBA4'}} />
					</linearGradient>

					{this.renderLinks(links, path)}
				</g>
			</svg>
		);

	}

});


module.exports = RefugeeSankey;
