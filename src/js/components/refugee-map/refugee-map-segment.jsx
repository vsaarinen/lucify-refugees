
var React = require('react');
var sprintf = require('sprintf');

var Inputs = require('lucify-commons/src/js/components/inputs.jsx');
var DividedCols = require('lucify-commons/src/js/components/divided-cols.jsx');
var FormRow = require('lucify-commons/src/js/components/nice-form-row.jsx');
var Slider = require('lucify-commons/src/js/components/nice-slider.jsx');
var lucifyUtils = require('lucify-commons/src/js/lucify-utils.jsx');
var ComponentWidthMixin = require('lucify-commons/src/js/components/container-width-mixin.js');

var RefugeeMap = require('./responsive-refugee-map.jsx');
var RefugeePlayContextDecorator = require('./refugee-play-context-decorator.jsx');
var TimeLayer = require('./refugee-map-time-layer.jsx');
var refugeeConstants = require('../../model/refugee-constants.js');


var RefugeeMapSegment = React.createClass({


	mixins: [ComponentWidthMixin],


    updateForStamp: function(stamp) {
    	this.refs.rmap.updateForStamp(stamp);
    	this.refs.time.updateForStamp(stamp);
	},


	interactionsEnabled: function() {
		return !lucifyUtils.isSlowDevice();
	},


	getPeoplePerPointText: function() {
		return (
			<span>
				Each moving point on the map corresponds
				to {this.props.peoplePerPoint} underage
        asylum seeker.
			</span>
		)
	},


	getCountsInstruction: function() {
		if (refugeeConstants.labelShowBreakPoint < this.componentWidth) {
			return (
				<span>
					The counts shown on hover represent the number
					of people who have left or arrived in the country
					since 2011.
				</span>
			);
		}
		return null;
	},


	getInteractionsInstruction: function() {
		if (this.interactionsEnabled()) {
			return <div>
				<p className="first">
					Hover over countries to
					show details. Click on a country to
					lock the selection.
					{' '}{this.getCountsInstruction()}
				</p>

				<p className="last">
					The line chart displays the total rate of
					underage asylum seekers over time. Hover over the
					chart to move the map in time.
				</p>
			</div>
		} else {
			return <p className="first last">
					The line chart displays the total rate of
					underage asylum seekers over time. Hover over the
					chart to move the map in time.
			</p>
		}
	},


	render: function() {
		return (
			<div className="refugee-map-segment">
				<Inputs>
					<div className="lucify-container">
						<DividedCols
							first={
								<div className="inputs__instructions">
									<h3>Instructions</h3>
									<p className="first">
										The map below shows the flow of
										{' '}<b>underage asylum seekers</b>{' '}
										to
										{' '}<b>Finland</b>{' '}
										over time.
									</p>

									<p>
										{this.getPeoplePerPointText()}
									</p>

                  <FormRow
										title={<div>Speed</div>}
										input={<Slider min={1} max={50}
											defaultValue={this.props.speed}
											onChange={this.props.handleSpeedChange} />} />

								</div>
							}
							second={
								<div className="inputs__instructions">
									{this.getInteractionsInstruction()}
								</div>
							} />
					</div>
				</Inputs>

				<TimeLayer
				  ref="time"
		          onMouseOver={this.props.handleStampChange}
		          stamp={this.props.stamp}
		          refugeeCountsModel={this.props.refugeeCountsModel}
		          mapModel={this.props.mapModel} />

				<RefugeeMap ref="rmap"
					{...this.props}
					interactionsEnabled={this.interactionsEnabled()} />
			</div>
		);
	}

});



module.exports = RefugeePlayContextDecorator(RefugeeMapSegment);
