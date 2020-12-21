import React from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import clsx from 'clsx';

import TextField from '@material-ui/core/TextField';

import I18n from '@iobroker/adapter-react/i18n';
import Logo from '@iobroker/adapter-react/Components/Logo';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: '100%',
        maxWidth: 400,
    },
    selectControl: {
        width: 400,
        paddingBottom: 20,
    }
});

const Debounces = props => {
    return <form className={props.classes.tab}>
        {props.roles.map(role =>
            <div key={role} className={clsx(props.classes.column, props.classes.columnSettings)}>
                <TextField
                    fullWidth={true}
                    value={props.native[role + '_debounce']}
                    type="number"
                    helperText={I18n.t('ms')}
                    onChange={e => props.onChange(role + '_debounce', e.target.value)}
                    label={role}
                />
            </div>
        )}
    </form>;
}

Debounces.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(Debounces);
