//============================================================================
// Distributed under the Apache License, Version 2.0.
// Author: Raphael Menges (raphaelmenges@uni-koblenz.de)
//============================================================================
// Action which displays keyboard and delivers text input.

// Notes
// - Input: none
// - Output: std::u16string text
// - Output: int submit (0 if not, else submit)

#ifndef KEYBOARDACTION_H_
#define KEYBOARDACTION_H_

#include "Action.h"

class KeyboardAction : public Action
{
public:

    // Constructor
    KeyboardAction(TabInteractionInterface* pTab);

    // Destructor
    virtual ~KeyboardAction();

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

    // Update text block
    void UpdateTextBlock();

    // Index of floating frame in Tab's overlay
    int _overlayFrameIndex = -1;

    // Id of keyboard in overlay
    std::string _overlayKeyboardId;

    // Id of complete button in overlay
    std::string _overlayCompleteButtonId;

    // Id of submit button in overlay
    std::string _overlaySubmitButtonId;

    // Id of delete character button in overlay
    std::string _overlayDeleteCharacterButtonId;

    // Id of space button in overlay
    std::string _overlaySpaceButtonId;

    // Id of text block in overlay
    std::string _overlayTextBlockId;

    // Id of word suggest in overlay
    std::string _overlayWordSuggestId;

    // Id of shift button in overlay
    std::string _overlayShiftButtonId;

    // String which collects input
    std::u16string _text = u"";

    // String with current word
    std::u16string _currentWord = u"";

    // Bool which indicates whether input is complete
    bool _complete = false;

    // Bool which indicates whether text should submitted directly
    bool _submit = false;
};

#endif // KEYBOARDACTION_H_