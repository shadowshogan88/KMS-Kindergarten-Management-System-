import { Link, useLocation } from 'react-router-dom';
import { LuChevronRight } from 'react-icons/lu';
import { menuItemsData } from './menu';
import { canPortal } from '@/utils/portalPermissions';

const isAllowedItem = item => {
  if (item?.href && String(item.href).startsWith('/portal/')) return canPortal(item.href, 'view');
  return true;
};

const filterMenu = items => {
  const out = [];
  for (const it of items || []) {
    if (it.isTitle) {
      out.push(it);
      continue;
    }
    if (it.children?.length) {
      const kids = filterMenu(it.children).filter(c => !c.isTitle);
      if (kids.length) out.push({ ...it, children: kids });
      continue;
    }
    if (isAllowedItem(it)) out.push(it);
  }

  // Remove leading/trailing titles and duplicate titles.
  const cleaned = [];
  for (const it of out) {
    if (it.isTitle) {
      if (!cleaned.length) continue;
      const prev = cleaned[cleaned.length - 1];
      if (prev?.isTitle) continue;
    }
    cleaned.push(it);
  }
  while (cleaned.length && cleaned[cleaned.length - 1]?.isTitle) cleaned.pop();
  return cleaned;
};
const isItemActive = (item, pathname) => {
  if (item.href && pathname === item.href) return true;
  if (item.children) {
    return item.children.some(child => isItemActive(child, pathname));
  }
  return false;
};
const MenuItemWithChildren = ({
  item
}) => {
  const {
    pathname
  } = useLocation();
  const Icon = item.icon;
  const isActive = isItemActive(item, pathname);
  return <li className={`menu-item hs-accordion ${isActive ? 'active' : ''}`}>
      <button className={`hs-accordion-toggle menu-link ${isActive ? 'active' : ''}`}>
        {Icon && <span className="menu-icon">
            <Icon />
          </span>}
        <span className="menu-text">{item.label}</span>
        <span className="menu-arrow">
          <LuChevronRight />
        </span>
      </button>

      <ul className={`sub-menu hs-accordion-content hs-accordion-group ${isActive ? 'block' : 'hidden'}`}>
        {item.children?.map(child => child.children ? <MenuItemWithChildren key={child.key} item={child} /> : <MenuItem key={child.key} item={child} />)}
      </ul>
    </li>;
};
const MenuItem = ({
  item
}) => {
  const {
    pathname
  } = useLocation();
  const Icon = item.icon;
  const isActive = pathname === item.href;
  return <li className={`menu-item ${isActive ? 'active' : ''}`}>
      <Link to={item.href ?? '#'} className={`menu-link ${isActive ? 'active' : ''}`}>
        {Icon && <span className="menu-icon">
            <Icon />
          </span>}
        <div className="menu-text">{item.label}</div>
      </Link>
    </li>;
};
const AppMenu = () => {
  return <ul className="side-nav p-3 hs-accordion-group">
      {filterMenu(menuItemsData).map(item => item.isTitle ? <li className="menu-title" key={item.key}>
            <span>{item.label}</span>
          </li> : item.children ? <MenuItemWithChildren key={item.key} item={item} /> : <MenuItem key={item.key} item={item} />)}
    </ul>;
};
export default AppMenu;
