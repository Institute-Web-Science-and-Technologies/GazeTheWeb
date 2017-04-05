//============================================================================
// Distributed under the Apache License, Version 2.0.
// Author: Raphael Menges (raphaelmenges@uni-koblenz.de)
//============================================================================
// Action to zoom to a coordinate with gaze.
// - Input: none
// - Output: vec2 coordinate in CEFPixel space

#ifndef ZOOMCOORDINATEACTION_H_
#define ZOOMCOORDINATEACTION_H_

#include "src/State/Web/Tab/Pipelines/Actions/Action.h"
#include "src/Utils/LerpValue.h"
#include <vector>

class ZoomCoordinateAction : public Action
{
public:

    // Constructor
    ZoomCoordinateAction(TabInteractionInterface* pTab, bool doDimming = true);

    // Update retuns whether finished with execution
    virtual bool Update(float tpf, TabInput tabInput);

    // Draw
    virtual void Draw() const;

    // Activate
    virtual void Activate();

    // Deactivate
    virtual void Deactivate();

    // Abort
    virtual void Abort();

protected:

	// States of zooming
	enum class State { ZOOM, DEBUG };

	// Sample data
	struct SampleData
	{
		// Constructor
		SampleData(
			float logZoom,
			glm::vec2 relativeGazeCoordinate,
			glm::vec2 relativeZoomCoordinate,
			glm::vec2 relativeCenterOffset)
		{
			this->logZoom = logZoom;
			this->relativeGazeCoordinate  = relativeGazeCoordinate;
			this->relativeZoomCoordinate = relativeZoomCoordinate;
			this->relativeCenterOffset = relativeCenterOffset;
		}

		// Values
		float logZoom;
		glm::vec2 relativeGazeCoordinate;
		glm::vec2 relativeZoomCoordinate;
		glm::vec2 relativeCenterOffset;
		float lifetime = 0.5f; // intial lifetime in seconds
	};

	// Dimming duration
	const float DIMMING_DURATION = 0.5f; // seconds until it is dimmed

	// Dimming value
	const float DIMMING_VALUE = 0.3f;

	// Deviation fading duration (how many seconds until full deviation is back to zero)
	const float DEVIATION_FADING_DURATION = 1.0f;

	// Multiplier of movement towards center (one means, that on maximum zoom the outermost corner is moved into center)
	const float CENTER_OFFSET_MULTIPLIER = 0.f; // TODO: 0.25f;

	// Duration to replace current coordinate with input
	const float MOVE_DURATION = 0.5f;

	// Speed of zoom
	const float ZOOM_SPEED = 0.25f;

	// Maximum log zoom level of orientation phase
	const float MAX_ORIENTATION_LOG_ZOOM = 0.75f;

	// Drift correction zoom level (must be lower than MAX_LOG_ZOOM)
	const float MAX_DRIFT_CORRECTION_LOG_ZOOM = 0.5f;

    // Coordinate of center of zooming in relative page coordinates (not WebView, page!)
    glm::vec2 _relativeZoomCoordinate; // aka zoom coordinate

	// Offset to center of WebView in relative space
	glm::vec2 _relativeCenterOffset = glm::vec2(0, 0);

    // Log zooming amount (used for rendering)
	// Calculated as 1.f - log(_linZoom), so becoming smaller at higher zoom levels
    float _logZoom = 1.f; // [1..0]

    // Linear zooming amount (used for calculations)
	// Increasing while zooming
    float _linZoom = 1.f; // [1..]

    // Bool to indicate first update
    bool _firstUpdate = true;

	// Deviation of coordinate
	float _deviation = 0.f; // [0..1]

	// Dimming
	float _dimming = 0.f;

	// Do dimming
	bool _doDimming = true;

	// Sample data
	std::vector<SampleData> _sampleData;

	// State of action
	State _state = State::ZOOM;
};

#endif // ZOOMCOORDINATEACTION_H_
