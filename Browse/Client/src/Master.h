//============================================================================
// Distributed under the Apache License, Version 2.0.
// Author: Raphael Menges (raphaelmenges@uni-koblenz.de)
//============================================================================
// Master is owner of all objects but the CEF implementation which is handed over
// as pointer to the mediator interface at construction. Does window and eyeGUI
// management. Pause overlay is handled completely by Master.

#ifndef MASTER_H_
#define MASTER_H_

#include "src/CEF/Extension/CefMediator.h"
#include "src/State/Web/Web.h"
#include "src/State/Settings/Settings.h"
#include "src/Input/EyeInput.h"
#include "src/Setup.h"
#include "src/Utils/LerpValue.h"
#include "externals/OGL/gl_core_3_3.h"
#include "externals/eyeGUI-development/include/eyeGUI.h"

// Forward declaration
class Texture;
struct GLFWwindow;
class LabStream;

class Master
{
public:

    // Constructor takes pointer to CefMediator
    Master(CefMediator* pCefMediator);

    // Destructor
    virtual ~Master();

    // Run the master which updates CEF
    void Run();

    // Getter for window width and height
    int GetWindowWidth() const { return _width; }
    int GetWindowHeight() const { return _height; }

    // Get time provided by GLFW
	double GetTime() const;

    // Exit
	void Exit();

    // Set gaze visualization
    void SetGazeVisualization(bool show) { eyegui::setGazeVisualizationDrawing(_pGUI, show); }

    // Set show descriptions
    void SetShowDescriptions(bool show) { eyegui::setShowDescriptions(_pGUI, show); }

    // Get id of dictionary
    unsigned int GetDictionary() const { return _dictonaryId; }

    // ### EYEGUI DELEGATION ###

    // Add layout to eyeGUI
    eyegui::Layout* AddLayout(std::string filepath, int layer, bool visible);

    // Remove layout from eyeGUI
    void RemoveLayout(eyegui::Layout* pLayout);

private:

    // Give listener full access
    friend class MasterButtonListener;

    // Listener for GUI
    class MasterButtonListener: public eyegui::ButtonListener
    {
    public:

        MasterButtonListener(Master* pMaster) { _pMaster = pMaster; }
        virtual void hit(eyegui::Layout* pLayout, std::string id) {}
        virtual void down(eyegui::Layout* pLayout, std::string id);
        virtual void up(eyegui::Layout* pLayout, std::string id);

    private:

        Master* _pMaster;
    };

    // Instance of listener
    std::shared_ptr<MasterButtonListener> _spMasterButtonListener;

    // Loop of master
    void Loop();

    // Callbacks
    void GLFWKeyCallback(int key, int scancode, int action, int mods);
    void GLFWMouseButtonCallback(int button, int action, int mods);
    void GLFWCursorPosCallback(double xpos, double ypos);
    void GLFWResizeCallback(int width, int height);
    void GUIResizeCallback(int width, int height);
    void GUIPrintCallback(std::string message) const;

    // States
    std::unique_ptr<Web> _upWeb;
    std::unique_ptr<Settings> _upSettings;

    // GLFW window
    GLFWwindow* _pWindow;

    // Layer between framework and CEF
    CefMediator* _pCefMediator;

    // Pointer to eyeGUI
    eyegui::GUI* _pGUI;
    eyegui::GUI* _pSuperGUI; // extra GUI for example for pause overlay since it needs seperate input consumption

    // Time
    double _lastTime;

    // Window resolution
    int _width = setup::INITIAL_WINDOW_WIDTH;
    int _height = setup::INITIAL_WINDOW_HEIGHT;

    // GLFW callback reminder
    bool _leftMouseButtonPressed = false;
    bool _enterKeyPressed = false;

    // Current state
    StateType _currentState;

    // Eye input
    std::unique_ptr<EyeInput> _upEyeInput;

    // Id of dictionary in eyeGUI
    unsigned int _dictonaryId = 0;

    // Time until input is accepted
    float _timeUntilInput = setup::DURATION_BEFORE_INPUT;

    // Layout for pause button etc.
    eyegui::Layout* _pSuperLayout;

    // Emtpy layout to handle cursor floating frame that may not take input
    eyegui::Layout* _pCursorLayout;

    // Floating frame index of cusor
    unsigned int _cursorFrameIndex = 0;

    // Bool to indicate pause (PAUSED_AT_STARTUP used in constructor). Pauses input, not application!
    bool _paused = false;

    // Lerp value to show pause as dimming of whole screen
    LerpValue _pausedDimming;

    // Communication with LabStreamingLayer
    std::unique_ptr<LabStream> _upLabStream;
};

#endif // MASTER_H_