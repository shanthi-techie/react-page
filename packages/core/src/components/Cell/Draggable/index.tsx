import classNames from 'classnames';
import * as React from 'react';
import { DragPreviewImage, useDrag } from 'react-dnd';
import { CellDrag } from '../../../types/editable';
import {
  useCell,
  useCellPlugin,
  useHoverActions,
  useIsFocused,
  useIsLayoutMode,
  useOptions,
} from '../../hooks';

const icon =
  // tslint:disable-next-line:max-line-length
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAhCAYAAACbffiEAAAA6UlEQVRYhe2ZQQ6CMBBFX0njHg7ESXTp1p3uvIBewc3Em3AfdelSFwRDCAm01JRO+pa0lP8zzc9kMCKyAa7AFqhIixdwB44WuACHuHq8KWm1vwtgF1lMCPaWkevUNE3Qr9R17XTu1P5uvUdV+IpbG2qMGBH5xBYRAjUVUWPEjj10SS3XRFry3kha/VBTETVGcmqtDTVGFqdWn7k9ku96f88QNRVRYySn1tpQY8QptXz7qinmnpt7rZTIqbU21BgJ2mv1+XfCDVFTETVGjIg8SG8KP+RZ0I7lU+dmgRNgaKfyZVw9znT/R85fOHJJE77U6UcAAAAASUVORK5CYII=';

const DefaultSmallHandle = () => (
  <div className="ory-cell-draggable-overlay-handle">
    <div className="ory-cell-draggable-overlay-handle-icon" />
  </div>
);

type Props = {
  isLeaf?: boolean;
  nodeId: string;
};
const Draggable: React.FC<Props> = ({ isLeaf, children, nodeId }) => {
  const preventBlurWhenClickingOnHandle = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
    },
    []
  );
  const cell = useCell(nodeId);
  const plugin = useCellPlugin(nodeId);
  const actions = useHoverActions();
  const [{ isDragging }, dragRef, preview] = useDrag<
    CellDrag,
    void,
    {
      isDragging: boolean;
    }
  >({
    item: {
      type: 'cell',
      cell,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    begin(monitor) {
      actions.dragCell(cell.id);
    },
    end(item, monitor) {
      if (monitor.didDrop()) {
        // If the item drop occurred deeper down the tree, don't do anything
        return;
      }
      // If drag ended but drop did not occur, cancel dragging
      actions.cancelCellDrag();
    },
  });

  const focused = useIsFocused(nodeId);

  const isLayoutMode = useIsLayoutMode();
  const options = useOptions();

  if (!isLayoutMode && !options.allowMoveInEditMode) {
    return (
      <div className="ory-cell-draggable-container">
        {/* these divs are here to prevent page jumping, they are a placeholder for draggable / draggable-overlay */}
        <div className="ory-cell-draggable-overlay-placeholder" />
        {children}
      </div>
    );
  }

  if (options.allowMoveInEditMode && !isLayoutMode) {
    return (
      <>
        <DragPreviewImage connect={preview} src={icon} />
        <div
          className={classNames({
            'ory-cell-draggable-in-edit': options.allowMoveInEditMode,
            'ory-cell-draggable': isLayoutMode && !options.allowMoveInEditMode,
            'ory-cell-draggable-is-dragging': isDragging,
          })}
          onMouseDown={preventBlurWhenClickingOnHandle}
        >
          {focused ? (
            <div ref={dragRef}>
              {options.editModeResizeHandle ?? <DefaultSmallHandle />}
            </div>
          ) : null}
          <div>{children}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <DragPreviewImage connect={preview} src={icon} />
      <div
        ref={dragRef}
        className={classNames({
          'ory-cell-draggable': isLayoutMode,
          'ory-cell-draggable-is-dragging': isDragging,
        })}
      >
        <div
          className={classNames({
            'ory-cell-draggable-overlay': isLayoutMode,
            [`ory-cell-draggable-inline-${cell.inline}`]: cell.inline,
            'ory-cell-draggable-leaf': isLeaf,
          })}
        >
          <div className="ory-cell-draggable-overlay-description">
            <span>{plugin?.text}</span>
          </div>
        </div>
        <div>{children}</div>
      </div>
    </>
  );
};

export default Draggable;
