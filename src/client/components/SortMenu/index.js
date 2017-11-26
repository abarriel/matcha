import React from 'react';
import PropTypes from 'prop-types';
import { map } from 'ramda';
import styled from 'styled-components';
import { Menu, MenuItem, PopoverInteractionKind, Popover, Position } from '@blueprintjs/core';
import { onlyUpdateForKeys } from 'recompose';

const Container = styled.div`
    position: ${({ position }) => position};
    top: ${({ top }) => top};
    left: ${({ left }) => left};
    display:flex;
    margin-top:${({ top }) => top};
    z-index:1000;
`;

const Button = styled.div`
    display:flex;
    justify-content: center;
    align-items: center;
    width:40px;
    height:40px;
    background-color:white;
    border-radius:3px;
    cursor:pointer;
`;

const menuItemsIcon = {
    asc: 'pt-icon-caret-up',
    desc: 'pt-icon-caret-down',
};

const SortMenu = ({ sortTypes, handleClick, sort }) => (
    <Menu>
        {map(
        ({ key, label }) =>
            sort.by === key ? (
            <MenuItem
                key={key}
                text={label}
                onClick={() => handleClick(key)}
                iconName={menuItemsIcon[sort.order]}
            />
            ) : (
            <MenuItem key={key} text={label} onClick={() => handleClick(key)} />
            ),
        sortTypes,
        )}
    </Menu>
);

SortMenu.propTypes = {
    handleClick: PropTypes.func.isRequired,
    sort: PropTypes.object.isRequired,
    sortTypes: PropTypes.array.isRequired,
};

const SortMenuWrapper = ({
    sortTypes,
    onClick,
    sort,
    position = 'fixed',
    icon,
    top = '0px',
    left = '0px',
}) => (
    <Container position={position} top={top} left={left}>
        <Popover
            position={Position.BOTTOM_LEFT}
            interactionKind={PopoverInteractionKind.CLICK}
            content={
                <SortMenu sortTypes={sortTypes} handleClick={onClick} sort={sort} />
            }
        >
        <Button>
            <i className={`fa fa-${icon}`} aria-hidden="true"></i>
        </Button>
        </Popover>
    </Container>
  );

  SortMenuWrapper.propTypes = {
    onClick: PropTypes.func.isRequired,
    sort: PropTypes.object.isRequired,
    sortTypes: PropTypes.array.isRequired,
    icon: PropTypes.string.isRequired,
    top: PropTypes.string,
    left: PropTypes.string,
  };

  export default onlyUpdateForKeys(['sort'])(SortMenuWrapper);
