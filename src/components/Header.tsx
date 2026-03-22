'use client'

export default function Header() {
  return (
    <header className="header">
      <div className="client-switcher">
        <label>Client:</label>
        <select defaultValue="demo">
          <option value="demo">RoofCo Exteriors</option>
          <option value="demo2">GreenLawn Pros</option>
          <option value="demo3">BrightSmile Dental</option>
        </select>
      </div>
      <div className="user-menu">
        <span className="user-name">Admin User</span>
        <div className="user-avatar">A</div>
      </div>
    </header>
  )
}
