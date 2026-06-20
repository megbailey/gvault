import React from "react";

const Settings = () => {
    return (
        <div>
            <h2>Settings</h2>
            <label>Default Argon2 Memory (KB)</label>
            <input id='memory' value='65536'></input>
        </div>
    )
}

export default Settings;