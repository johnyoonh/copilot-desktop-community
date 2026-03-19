-- The name of your specific Reminders list
property listName : "Copilot"

on idle
	tell application "Reminders"
		-- Get all incomplete reminders in the specific list
		set theReminders to reminders of list listName whose completed is false
		
		repeat with aReminder in theReminders
			set thePrompt to name of aReminder
			
			-- Trigger the Copilot App using standard 'q' parameter
			do shell script "open \"copilot://?q=" & my urlEncode(thePrompt) & "\""
			
			-- Mark the reminder as completed so it doesn't trigger again
			set completed of aReminder to true
		end repeat
	end tell
	
	-- Check every 10 seconds
	return 10
end idle

on urlEncode(theText)
	return do shell script "python3 -c \"import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))\" " & quoted form of theText
end urlEncode
