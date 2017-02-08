//============================================================================
// Distributed under the Apache License, Version 2.0.
// Author: Daniel Mueller (muellerd@uni-koblenz.de)
//============================================================================

window.domLinks = [];
window.domTextInputs = [];
window.overflowElements = [];


function PerformTextInput(inputId, text, submit)
{
    var domObj = GetDOMObject(0, inputId);
    if(domObj !== null)
    {
        // DEBUG
        console.log("Text to input: "+text);

        domObj.setTextInput(text, submit);
        return true;
    }
    else return false;
}

function ScrollOverflowElement(elemId, gazeX, gazeY, fixedIds)
{
    // console.log(fixedIds);

    var overflowObj = GetOverflowElement(elemId);
    if(overflowObj !== null && overflowObj !== undefined)
    {
        // TODO: Move scrolling computation to C++ Tab::ScrollOverflowElement
        // Add solution for scrolling if edge of overflow is covered by a fixed element and scroll at the edge of fixed element
        if(fixedIds !== null && fixedIds.length > 0)
        {
            var childFixedId = overflowObj.node.getAttribute("childFixedId");
            
            if(childFixedId === null || 
                (childFixedId !== null && fixedIds.indexOf(childFixedId) === -1)  // child id not contained in list
            )
            {
                // Skip scrolling, because overflow is hidden by fixed element with "fixedId"
                return;
            }
        }
        overflowObj.scroll(gazeX,gazeY);
    }
}

// TODO: Create own Rect class, remove all arrays used to represent rects, include Rect operations in Rect class

/**
 * Usage example: Determine what parts of a node's rect are visible when inside an overflowing element
 */
function CutRectOnRectWindow(innerRect, outerRect)
{
    if(!(innerRect.length > 0) || !(outerRect.length > 0))
        return [0,0,0,0];

    var t = Math.max(innerRect[0], outerRect[0]);
    var l = Math.max(innerRect[1], outerRect[1]);
    var b = Math.min(innerRect[2], outerRect[2]);
    var r = Math.min(innerRect[3], outerRect[3]);
    
    // return size zero rect if edges flipped sides
    if(t >= b || l >= r) 
        return [0,0,0,0]

    return [t, l, b, r]
}

/**
 * Usage example: Cut-off |target| rect parts covered by an overlying fixed element |overlay|
 */
function CutOutRect(target, overlay)
{
    if(overlay.length === 0 || target.length === 0)
        return target;

    // TODO: This procedure needs to be refined, with possible multi-rect output, if covered partially
    // and it should be moved to C++ Tab, when C++ DOM objects are extended by childFixedId

    // NOTE: This is a quick fix for GMails Mail Header, which can't be clicked due to click correction on links in the background
    // Only cutting of right and left parts of target

    var cutoff = CutRectOnRectWindow(target, overlay);

    // DEBUG
    // DrawRect(cutoff);

    if(cutoff.reduce(function(a,b){return a+b},0) === 0)    // Add all elements in list, the functional way :)
        return target;  // Nothing cut-off

    // Cut-off part is on the right
    if(cutoff[1] > target[1])
    {
        target[3] = cutoff[1];
    }
    else // Cut-off part is on the right
    {
        target[1] = cutoff[3];
    }
    return target;
}

/**
 * Usage example: Starting at your current node, climb up DOM tree until overflow parent is found, which might hide this starting node
 */
function GetNextOverflowParent(node)
{
    var parent = node.parentNode;
    while(parent !== null || parent === document.documentElement)
    {
        if(parent.nodeType === 1)
        {
            // style.overflow = {visible|hidden|scroll|auto|initial|inherit}
            var overflow_prop = window.getComputedStyle(parent, null).getPropertyValue('overflow');
            if(overflow_prop !== 'visible')
            {
                return parent;
            }
        }
        parent = parent.parentNode;
    }
    // no overflow parent found
    return null;
}

/**
 * Constructor
 */
function DOMObject(node, nodeType)
{
    /* Attributes */
        this.node = node;
        this.nodeType = nodeType;
        this.rects = AdjustClientRects(this.node.getClientRects());
        this.visible = true;    // default value, call DOMObj.checkVisibility() after object is created!
        this.fixed = (node.hasAttribute("childFixedId")) ? true : false;
        this.overflowParent = undefined;
        this.text = "";
        this.isPassword = false;

    /* Methods */ 
        // Update member variable for Rects and return true if an update has occured 
        this.updateRects = function(){
            this.checkVisibility();

            // Get new Rect data
            var updatedRectsData = AdjustClientRects(this.node.getClientRects());

            if(this.fixed)
            {
                updatedRectsData.map( function(rectData){ rectData = SubstractScrollingOffset(rectData);} );
            }


            // NOTE: GMail fix
            if(this.nodeType !== 0)
            {
                for(var i = 0; i < domFixedElements.length; i++)
                {
                    var fixedObj = domFixedElements[i];
                    if(fixedObj !== null && fixedObj !== undefined)
                    {
                        updatedRectsData.map(
                            function(rectData)
                            {
                                rectData = fixedObj.rects.reduce(
                                    function(target, overlay){
                                        return CutOutRect(target, overlay);
                                    }, 
                                    rectData
                                );
                            }
                        );
                    }
                }
            }
 

            // Compare new and old Rect data
            var equal = CompareClientRectsData(updatedRectsData, this.rects);

            // Rect updates occured and new Rect data is accessible
            if(!equal && updatedRectsData !== undefined)
            {
                this.rects = updatedRectsData;
                InformCEF(this, ['update', 'rects']); 
            }

            // Also, update text content if input field
            if(this.nodeType == 0)   // Only needed for text inputs
            {
                this.updateText();
            }
            
            return !equal;
        };

        

        // Returns float[4] for each Rect with adjusted coordinates
        this.getRects = function(){
            if(this.visible && this.overflowParent !== null && this.overflowParent !== undefined && 
                (id = this.overflowParent.getAttribute("overflowId")) ) 
            {
                // TODO: Work on OverflowElemen Objects and their getRects method instead!
                // var bb_overflow = this.overflowParent.getBoundingClientRect();
                var obj = GetOverflowElement(id);
                if(obj !== null && obj !== undefined )
                {
                    var oRect = obj.getRects()[0];

                    var rects = AdjustClientRects(this.node.getClientRects());
                    var new_rects = [];

                    rects.forEach(
                        function(rect){
                            new_rects.push(
                                CutRectOnRectWindow(rect, oRect)
                            );
                        }
                    );
              
                    return new_rects;
                }
                else
                {
                    return this.rects;
                }

            }

            // Return rects as list of float lists with adjusted coordinates
            return this.rects;
        };

        this.setFixed = function(fixed){
            if(this.fixed != fixed)
            {
                this.fixed = fixed;
                InformCEF(this, ['update', 'fixed']);
                this.updateRects();
            }
        };

        this.setVisibility = function(visible){
            if(this.visible != visible)
            {
                this.visible = visible;
                InformCEF(this, ['update', 'visible']);
                if(visible) this.updateRects();
            }
        };

        this.checkVisibility = function(){
            var visibility = window.getComputedStyle(this.node, null).getPropertyValue('visibility');

            // Set visibility to hidden if bounding box is of resolution is 0 in any direction
            var bb = this.node.getBoundingClientRect();
            if(bb.width == 0 || bb.height == 0) { visibility = 'hidden'; }


            // Check if any parent node has opacity near zero, if yes, child (this node) might not be visible
            var root = this.node;
            while(root !== document.documentElement && root && root !== undefined)
            {
                if(window.getComputedStyle(root, null).getPropertyValue('opacity') < 0.0001)
                {
                    visibility = 'hidden';
                    break;
                }
                root = root.parentNode;
            }

            switch(visibility)
            {
                case 'hidden': { this.setVisibility(false); return; }
                case '':
                case 'visible': { /*this.setVisibility(true);*/ break; }
                default:
                { 
                    ConsolePrint("DOMObj.checkVisibility() - visibility="+visibility+" currently handled as 'visible'.");
                    // this.setVisibility(true);
                }
            }

            if(this.overflowParent)
            {
                var overflowRect = this.overflowParent.getBoundingClientRect();
                var nodeRect = this.node.getBoundingClientRect();

                // DEBUG
                // ConsolePrint("Comparing node's bounding box with overflow parent's bounding box...");
                // ConsolePrint("overflow box: "+overflowRect.top+","+overflowRect.left+","+overflowRect.bottom+","+overflowRect.right);
                // ConsolePrint("node's   box: "+nodeRect.top+","+nodeRect.left+","+nodeRect.bottom+","+nodeRect.right);

                // Test if overflow box is more than a thin line
                if( (overflowRect.height > 0 && overflowRect.width > 0) &&
                    // // Test if node's Rect lies completely inside of overflow Rect, then node is visible
                    // !(overflowRect.left <= nodeRect.left && overflowRect.right >= nodeRect.right && 
                    // overflowRect.top <= nodeRect.top && overflowRect.bottom >= nodeRect.bottom))
                    (overflowRect.top >= nodeRect.bottom || overflowRect.bottom <= nodeRect.top 
                        || overflowRect.left >= nodeRect.right || overflowRect.right <= nodeRect.left) )
                    {
                        this.setVisibility(false);
                        // DEBUG
                        // ConsolePrint("Node's box is outside, so it's not visible!");
                        return;
                    }
                // ConsolePrint("Node's box is inside, so node is visible!");

            }
            this.setVisibility(true);

        }

        this.searchOverflows = function(){
            this.overflowParent = GetNextOverflowParent(this.node);
        }

        this.setTextInput = function(text, submit){
            ConsolePrint("tagName: "+this.node.tagName);
            ConsolePrint("setTextInput called with text='"+text+"' and submit="+submit);
     

            // Only executable if DOMNode is TextInput field
            if(this.nodeType === 0)
            {
                if(this.node.tagName == "TEXTAREA")
                {

                    this.node.value = text;
                }
                else if (this.node.tagName == 'INPUT')
                {
                    // GOOGLE FIX
                    var inputs = this.node.parentNode.getElementsByTagName("INPUT");
                    var n = inputs.length;
                    var zIndex = window.getComputedStyle(this.node, null).getPropertyValue('z-index');
                    for(var i = 0; i < n && n > 1; i++)
                    {
                        if(inputs[i] !== this.node && inputs[i].type == this.node.type)
                        {
                            if(zIndex < window.getComputedStyle(inputs[i], null).getPropertyValue('z-index'))
                            {
                                inputs[i].value = text;
                                ConsolePrint("Set text input on another input field with higher z-index");
                            }
                        }
                    }
                    
                    this.node.value = text;

                }
                else
                {
                    this.node.textContent = text;
                    ConsolePrint("Set input's value to given text");
                }
                
                // Assuming text input works in any case (no feedback needed), so that input text is now displayed
                this.text = text;
                InformCEF(this, ["update", "text"]);
                
                // ConsolePrint("Input text was set!");

                if(submit)
                {
                    // NOTE: Emulate pressing Enter in input field?

                    var parent = this.node.parentNode;
                    var no_form_found = false;
                    while(parent.nodeName != 'FORM')
                    {
                        parent = parent.parentNode;
                        if(parent === document.documentElement)
                        {
                            ConsolePrint('Could not submit text input: No child of any form element.');
                            no_form_found = true;
                            break;
                        }
                    }
                    if(!no_form_found)
                    {
                        parent.submit();
                        ConsolePrint("Input text was submitted.");
                    }
                
                }

            }
        };

        this.updateText = function()
        {
                var old_text = this.text;

                if(this.node.tagName == "INPUT") // this.node.tagName == "TEXTAREA" ||  // for tweets at people
                {
                    if(this.node.value !== undefined && this.node.value !== null)
                        this.text = this.node.value;
                }
                else
                {
                    if(this.node.textContent !== undefined && this.node.textContent !== null)
                    this.text = this.node.textContent;
                }
                if(old_text !== this.text)
                {
                    InformCEF(this, ["update", "text"]);
                }

        }

/* -------------- Code, executed on object construction -------------- */
        
        // Push to list and determined by DOMObjects position in type specific list
        var domObjList = GetDOMObjectList(this.nodeType);

        // This should never fail
        if(domObjList !== undefined)
        {
            domObjList.push(this);
            var nodeID = domObjList.length - 1;
            // Add attributes to given DOM node
            this.node.setAttribute('nodeID', nodeID);
            this.node.setAttribute('nodeType', this.nodeType);
            
            // Create empty DOMNode object on C++ side
            InformCEF(this, ['added']);

            // Setup of attributes
            this.checkVisibility();
            this.searchOverflows();


            // Send msg if already fixed on creation!
            if(this.fixed)
            {
                InformCEF(this, ['update', 'fixed']);
            }

            // Set displayed text, depending on given node type
            // TODO/IDEA: (External) function returning node's text attribute, corresponding to node's tagName & type
            if(this.nodeType == 0)   // Only needed for text inputs
            {
                this.updateText();
            }

            if(this.node.tagName == "INPUT" && this.node.type == "password")
            {
                // Update attribute 4 aka (bool) isPasswordField=true, the last 1 for 'true' could be skipped, 
                // but MsgRouter needs 5 arguments in encoded string for attribute updates
                ConsolePrint("DOM#upd#"+this.nodeType+"#"+nodeID+"#4#1#");
            }


        }
        else
        {
            ConsolePrint("ERROR: No DOMObjectList found for adding node with type="+nodeType+"!");
        }



}

/**
 * Create a DOMObject of given type for node and add it to the global list
 * Also, automatically inform CEF about added node and in case of Rect updates
 * 
 * args:    node : DOMNode, nodeType : int
 * returns: void
 */
function CreateDOMObject(node, nodeType)
{
    // Only add DOMObject for node if there doesn't exist one yet
    if(!node.hasAttribute('nodeID'))
    {
        // Create DOMObject, which encapsulates the given DOM node
        var domObj = new DOMObject(node, nodeType);
    }
    else
    {
        // ConsolePrint("Useless call of CreateDOMObject");
    }
}

function CreateDOMTextInput(node) { CreateDOMObject(node, 0); }
function CreateDOMLink(node) { CreateDOMObject(node, 1); }




/**
 * Adjusts given DOMRects to window properties in order to get screen coordinates
 * 
 * args:    rects : [DOMRect]
 * return:  [[float]] - top, left, bottom, right coordinates of each DOMRect in rects
 */
function AdjustClientRects(rects)
{
	// function RectToFloatList(rect){ return [rect.top, rect.left, rect.bottom, rect.right]; };

    // .getClientRects() may return an empty DOMRectList{}
    if(rects.length === 0)
    {
        return [[0,0,0,0]];
    }

    var adjRects = [];
    for(var i = 0, n = rects.length; i < n; i++)
    {
        adjRects.push(
            AdjustRectCoordinatesToWindow(rects[i])
        );
    }

    return adjRects;
}

/**
 * Compares two lists of DOMRect objects and returns true if all values are equal
 * 
 * args:    rects1, rects2 : [DOMRect]
 * returns: bool
 */
function CompareClientRects(rects1, rects2)
{
	var n = rects1.length;

	if(n != rects2.length)
		return false;

	// Check if width and height of each Rect are identical
	for(var i = 0; i < n; i++)
	{
		if(rects1[i].width != rects2[i].width || rects1[i].height != rects2[i].height)
			return false;
	}

	// Check if Rect coordinates are identical
	for(var i = 0; i < n; i++)
	{
		// Note: It's enough to check x & y if width & height are identical
		if(rects1[i].x != rects2[i].x || rects1[i].y != rects2[i].y)		
			return false;
	}

	return true;
}

/**
 * Compares two lists of type [[float]] and returns true if all values are equal
 * 
 * args:    rects1, rects2 : [[float]]
 * returns: bool
 */
function CompareClientRectsData(rects1, rects2)
{
    if(rects2 === undefined || rects2 === null)
        return false;

    var n = rects1.length;

	if(n !== rects2.length)
		return false;

	// Check if width and height of each Rect are identical
	for(var i = 0; i < n; i++)
	{
		for(var j = 0; j < 4; j++)
        {
            if(rects1[i][j] !== rects2[i][j])
                return false;
        }
	}

	return true;
}

/**
 * Triggers update of DOMRects of each DOMObject by using DOMObjects updateRects() method
 * 
 * args:    -/-
 * returns: void
 */
function UpdateDOMRects()
{
    // DEBUG
    // ConsolePrint("UpdateDOMRects() called");

    // Trigger update of Rects for every domObject
    window.domTextInputs.forEach(
        function (domObj) { domObj.updateRects(); }
    );
    window.domLinks.forEach(
        function (domObj) { domObj.updateRects(); }
    );

    // ... and all OverflowElements
    window.overflowElements.forEach(
        function (overflowObj) {
            overflowObj.updateRects(); 
        }
    );

    // ... and all FixedElements
    window.domFixedElements.forEach(
        function(fixedObj){ if(fixedObj !== undefined){fixedObj.updateRects();} }
    );

   
    // Update visibility of each DOM object
    window.domTextInputs.forEach(
        function (domObj) { domObj.searchOverflows(); domObj.checkVisibility(); }
    );
    window.domLinks.forEach(
        function (domObj) { domObj.searchOverflows(); domObj.checkVisibility(); }
    );


}

function UpdateChildrensDOMRects(parent)
{
    ForEveryChild(parent, function(child){
        if(child.nodeType == 1)
        {
            if((nodeType = child.getAttribute("nodeType")) !== undefined && nodeType !== null)
            {
                var nodeID = child.getAttribute("nodeID");
                if((domObj = GetDOMObject(nodeType, nodeID)) !== undefined)
                {
                    domObj.searchOverflows(); 
                    domObj.checkVisibility(); 
                    domObj.updateRects();
                } 
            }

            if((overflowId = child.getAttribute("overflowId")) !== undefined && overflowId !== null)
            {
                if((overflowObj = GetOverflowElement(overflowId)) !== undefined)
                {
                    overflowObj.updateRects();
                }
            }

        }
    });

}

/**
 * Transform natural language to encoded command to send to CEF
 * Relies on existing nodeId in domObj.node!
 * 
 * args:    domObj : DOMObject, operation : [string]
 * returns: void
 */
function InformCEF(domObj, operation)
{
    var id = domObj.node.getAttribute('nodeID');
    var type = domObj.nodeType;

    if(id !== undefined && type !== undefined)
    {
        // Encoding uses only first 3 chars of natural language operation
        var op = operation[0].substring(0,3);

        var encodedCommand = 'DOM#'+op+'#'+type+'#'+id+'#';

        if(op == 'upd')
        {
            if(operation[1] == 'rects')
            {
                var rectsData = domObj.getRects();
                // Encode changes in 'rect' as attribute '0'
                encodedCommand += '0#';
                // Encode list of floats to strings, each value separated by ';'
                for(var i = 0, n = rectsData.length; i < n; i++)
                {
                    for(var j = 0; j < 4; j++)
                    {
                        encodedCommand += (rectsData[i][j]+';');
                    }
                }
                // Add '#' at the end to mark ending of encoded command
                encodedCommand = encodedCommand.substr(0,encodedCommand.length-1)+'#';
            }

            if(operation[1] == 'fixed')
            {
                // If fixed attribute doesn't exist, node is not fixed
                var status = (domObj.node.hasAttribute('fixedId')|| domObj.node.hasAttribute("childFixedId")) ? 1 : 0;
                // Encode changes in 'fixed' as attribute '1'
                encodedCommand += ('1#'+status+'#');

            }

            if(operation[1] == 'visible')
            {
                var status = (domObj.visible) ? 1 : 0;
                
                encodedCommand += ('2#'+status+'#');
                // ConsolePrint("encodedCommand: "+encodedCommand);
            }

            if(operation[1] == "text")
            {
                encodedCommand += ("3#"+domObj.text+"#");
            }
        }

        // Send encoded command to CEF
        ConsolePrint(encodedCommand);
    }
    else
    {
        ConsolePrint("ERROR: No DOMObject given to perform informing of CEF! id: "+id+", type: "+type);
    }
}

/**
 * Get global list of DOMObjects for specific node 
 * 
 * args:    nodeType : int
 * returns: [DOMObject]
 */
function GetDOMObjectList(nodeType)
{

    switch(nodeType)
    {
        case 0:
        case '0': { return window.domTextInputs; };
        case 1:
        case '1': { return window.domLinks; };
        case 2:
        case '2': { return window.overflowElements; }
        // NOTE: Add more cases if new nodeTypes are added
        default:
        {
            ConsolePrint('ERROR: No DOMObjectList for nodeType='+nodeType+' exists!');
            return null;
        }
    }
}


/**
 * Get DOMObject by using node's type and ID
 * 
 * args:    nodeType, nodeID : int
 * returns: DOMObject
 */
function GetDOMObject(nodeType, nodeID)
{
    var targetList = GetDOMObjectList(nodeType);

    // Catch error case
    if(nodeID >= targetList.length || targetList == undefined || nodeID === undefined || nodeID === null)
    {
        ConsolePrint('ERROR: Node with id='+nodeID+' does not exist for type='+nodeType+'!');
        return null;
    }

    return targetList[nodeID];
}

// ATTENTION: V8 doesn't seem to work with polymorphism of functions!

// /**
//  * Get corresponding DOMObject to a given node, if it doesn't exist 'undefined' is returned
//  * 
//  * args:    node : DOMNode
//  * return:  DOMObject
//  */
// function GetDOMObject(node)
// {
//     var id = node.getAttribute('nodeID');
//     var type = node.getAttribute('nodeType');

//     if(!id || !type)
//         return undefined;

//     return GetDOMObject(type, id);
// }


function OverflowElement(node)
{
    /* Attributes */
        this.node = node;
        this.rects = AdjustClientRects(this.node.getClientRects());
        this.fixed = false;
        this.overflowParent = GetNextOverflowParent(node);  // TODO: This should be performed by MutationObserver in order to be efficient!

        // this.overflowParent = undefined;

    /* Methods */
        this.getMaxTopScrolling = function(){
            return (this.node.scrollHeight - this.node.getBoundingClientRect().width);
        }
        this.getMaxLeftScrolling = function(){
            return (this.node.scrollWidth - this.node.getBoundingClientRect().height);
        }
        this.getTopScrolling = function(){
            return this.node.scrollTop;
        }
        this.getLeftScrolling = function(){
            return this.node.scrollLeft;
        }
        this.scroll = function(gazeX, gazeY){

            // Do not use cut-off rect and keep scrolling velocity untouched if partially hidden
            var rects = AdjustClientRects(this.node.getClientRects());
            //  var rect = this.getRects()[0];

            // Update scrolling position according to current gaze coordinates
            // Idea: Only scroll if gaze is somewhere near the overflow elements edges
            if(rects.length > 0)
            {
                var rect = rects[0];

                var centerX = rect[1] + Math.round(rect.width / 2);
                var centerY =  rect[0] + Math.round(rect.height / 2);

                var distLeft = gazeX - rect[1];   // negative values imply gaze outside of element
                var distRight = rect[3] - gazeX;
                var distTop = gazeY - rect[0];
                var distBottom = rect[2] - gazeY;

                // Treshold for actual scrolling taking place, maximum distance to border where scrolling takes place
                var tresholdX = 1 / 2.5 * ((rect[3]-rect[1]) / 2);
                var tresholdY = 1 / 2.5 * ((rect[2]-rect[0]) / 2);

                var maxScrollingPerFrame = 10;
                // Actual scrolling, added afterwards
                var scrollX = 0;
                var scrollY = 0;

                if(distLeft >= 0 && distLeft < tresholdX)
                {
                    scrollX -= (maxScrollingPerFrame * ( 1 - (distLeft / tresholdX) ));
                }
                if(distRight >= 0 && distRight < tresholdX)
                {
                    scrollX += (maxScrollingPerFrame * ( 1 - (distRight / tresholdX) ));
                }
                if(distTop >= 0 && distTop < tresholdY)
                {
                    scrollY -= (maxScrollingPerFrame * (1 - (distTop / tresholdY)));
                }
                if(distBottom >= 0 && distBottom < tresholdY)
                {
                    scrollY += (maxScrollingPerFrame * (1 - (distBottom / tresholdY)));
                }

                // Execute scrolling
                this.node.scrollLeft += scrollX;
                this.node.scrollTop += scrollY;

                // Return current scrolling position as feedback
                return [this.node.scrollLeft, this.node.scrollTop];
            }
         
        }

        this.getRects = function(){
            // TODO: Also check if maximal scrolling limits changed if Rect width or height changed
            return this.rects;
        }

        this.updateRects = function(){

            // this.checkVisibility(); // doesn't exist (yet?) for OverflowElements!

            // Get new Rect data
            var updatedRectsData = AdjustClientRects(this.node.getClientRects());

            // Cut rects on overflow parent, if existing
            if(this.overflowParent !== null)
            {
                // console.log("Checking cut-off of overflow element id: "+this.node.getAttribute("overflowId"))
                var overflowObj = GetOverflowElement(this.overflowParent.getAttribute("overflowId"));

                if(overflowObj !== null & overflowObj !== undefined)
                {
                    // console.log("Fetching OE parent should work")
                    var overflow_rect = overflowObj.getRects()[0];
                    // console.log(overflow_rect);
                    var cut_rect = [];
                    for(var i = 0; i < updatedRectsData.length; i++)
                    {
                        cut_rect.push(
                            CutRectOnRectWindow(updatedRectsData[i], overflow_rect)
                        );
                    }
                    updatedRectsData = cut_rect;
                }

            }
             
            if(this.fixed)
            {
                updatedRectsData.map( 
                    function(rectData){ 
                        rectData = SubstractScrollingOffset(rectData);
                    } 
                );
            }


            // Compare new and old Rect data
            var equal = CompareClientRectsData(updatedRectsData, this.rects);

            

            // Rect updates occured and new Rect data is accessible
            if(!equal && updatedRectsData !== undefined)
            {
                var id = this.node.getAttribute("overflowId");
                this.rects = updatedRectsData;

                var encodedCommand = "#ovrflow#upd#"+id+"#rect#";
                
                for (var i = 0; i < 4; i++)
                {                 
                    encodedCommand += this.rects[0][i];
                    if(i < 3) 
                    {
                        encodedCommand += ";";
                    }
                }
                encodedCommand += "#";                
                ConsolePrint(encodedCommand);
            }

            return !equal;
        };

        this.setFixed = function(fixed){
            if(this.fixed !== fixed)
            {
                this.fixed = fixed;
                
                // Inform CEF about changes in fixed attribute
                var id = this.node.getAttribute("overflowId");
                var numFixed = (fixed) ? 1 : 0;
                var encodedCommand = "#ovrflow#upd#"+id+"#fixed#"+numFixed+"#";
                ConsolePrint(encodedCommand);

                this.updateRects();
            }
        };

/* ------------ CODE EXECUTED ON CONSTRUCTION OF OBJECT ---------------- */

        // Extend DOM node by adding attribute that contains last used scrolling config
        this.node.last_scroll_config_updated = {x: this.node.scrollLeft, y: this.node.scrollTop};

        // Called when scrolling took place: Update child nodes
        this.node.onscroll = function(e){
            if(e.target.last_scroll_config_updated !== undefined && 
                (e.target.last_scroll_config_updated.x !== e.target.scrollLeft || e.target.last_scroll_config_updated.y !== e.target.scrollTop) )
            {
                // Perform update of children and save current scrolling config on whose basis update is performed
                e.target.last_scroll_config_updated = {x: e.target.scrollLeft, y: e.target.scrollTop};

                // Update Rects of all child elements
                ForEveryChild(e.target, function(child){
                    if(child.nodeType == 1)
                    {
                        if((nodeType = child.getAttribute("nodeType")) !== undefined && nodeType !== null)
                        {
                            var nodeID = child.getAttribute("nodeID");
                            if((domObj = GetDOMObject(nodeType, nodeID)) !== undefined)
                            {
                                domObj.updateRects();
                            } 
                        }

                        if((overflowId = child.getAttribute("overflowId")) !== undefined && overflowId !== null)
                        {
                            if((overflowObj = GetOverflowElement(overflowId)) !== undefined)
                            {
                                overflowObj.updateRects();
                            }
                        }
                    }
                });
            }
            // else
            // {
            //     console.log(e.target.getAttribute("overflowId")+": Scroll config hasn't changed, not perfoming any child updates.");
            // }  
        };

}


function CreateOverflowElement(node)
{
    if(!node.getAttribute("overflowId"))
    {
        var overflowObj = new OverflowElement(node);

        window.overflowElements.push(overflowObj);

        // Prepare informing CEF about added OverflowElement
        var outStr = "#ovrflow#add#";


        var id = window.overflowElements.length - 1;
        node.setAttribute("overflowId", id);

        var zero = (id < 10) ? "0" : "";
        outStr += (zero + id + "#");
        // #ovrflow#add#[0]id#


        // Note: Ignoring multiple Rects at this point...
        var rects = overflowObj.getRects();
        var rect = (rects.length > 0) ? rects[0] : [0,0,0,0];


        for(var i = 0; i < 4; i++)
        {
            outStr += rect[i];
            if(i !== 3) outStr += ";";  // Note: if-statement misses in DOMObjects --> different decoding atm
        }
        outStr += "#";
        // #ovrflow#add#[0]id#rect0;rect1;rect2;rect3#

        outStr +=  overflowObj.getMaxLeftScrolling();
        outStr += ";";
        outStr += overflowObj.getMaxTopScrolling();
        outStr += "#";
        // #ovrflow#add#[0]id#rect0;rect1;rect2;rect3#maxLeft;maxTop#

        ConsolePrint(outStr);

        //DEBUG
        // ConsolePrint("### OverflowElement created: "+outStr);
    }
   
}

// Called from CEF Handler
function GetOverflowElement(id)
{
    if(id < window.overflowElements.length && id >= 0)
        return window.overflowElements[id];     // This may return undefined
    else
    {
        ConsolePrint("ERROR in GetOverflowElement: id="+id+", valid id should be in [0, "+(window.overflowElements.length-1)+"]!");
        return null;
    }
        
}

function RemoveOverflowElement(id)
{
    if(id < window.overflowElements.length && id >= 0)
    {
        /* HACK FOR REMOVAL OF GLOBAL OVERFLOW ELEMENT CAUSING SCROLL LAGG */
        domLinks.forEach(function(obj){
            if(obj !== null && obj !== undefined)
            {
                if(obj.node !== null && obj.node !== undefined)
                {
                    if(obj.overflowParent == window.overflowElements[id].node)
                    {
                        obj.overflowParent = null;
                        obj.updateRects();
                    }
                }
            }
        });
        domTextInputs.forEach(function(obj){
            if(obj !== null && obj !== undefined)
            {
                if(obj.node !== null && obj.node !== undefined)
                {
                    if(obj.overflowParent == window.overflowElements[id].node)
                    {
                        obj.overflowParent = null;
                        obj.updateRects();
                    }
                }
            }
        });
        /* END OF HACK */

        window.overflowElements[id].node.removeAttribute("overflowId");
        delete window.overflowElements[id]; // TODO: Keep list space empty or fill when new OE is created?

        // Inform CEF about removed overflow element
        ConsolePrint("#ovrflow#rem#"+id);

    }
    else
    {
        ConsolePrint("ERROR: Couldn't remove OverflowElement with id="+id);
    }
}

function SubstractScrollingOffset(rectData)
{
	// Translate rectData by (-scrollX, -scrollY)
	rectData[0] -= window.scrollY;
	rectData[1] -= window.scrollX;
	rectData[2] -= window.scrollY;
	rectData[3] -= window.scrollX;
	return rectData;
}